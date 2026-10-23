import { useState, useEffect, useCallback, useRef } from 'react'
import { loadFullGame, findGameByHostKey, findGameByRoomCode, subscribeToGame } from './db.js'
import { recomputeScores } from './gameHelpers.js'

// ---------------------------------------------------------------------------
// Loads the game, keeps it in sync, and remembers who you are.
//
// WHO YOU ARE
//   Host    - the URL has ?host=<secret key>. Anyone with that link is the host.
//   Player  - your player id is kept in this browser's localStorage, so closing
//             the tab and coming back puts you straight back in with your score.
//
// STAYING IN SYNC
//   Any change to this game from any device triggers a full reload. Wasteful,
//   but it cannot get out of step, which matters more than efficiency for eight
//   people over one evening.
// ---------------------------------------------------------------------------

const STORAGE_GAME = 'trivia.gameId'
const STORAGE_PLAYER = 'trivia.playerId'
const STORAGE_HOST = 'trivia.hostKey'

function readStored(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Private browsing can block localStorage. Not fatal - it just means no
    // rejoin after a refresh, so fail quietly rather than breaking the app.
    return null
  }
}

function writeStored(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // See above.
  }
}

export function hostKeyFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('host')
  } catch {
    return null
  }
}

// --- The host's way back in -------------------------------------------------
// Being the host is nothing but holding the ?host=<key> link. There is no login
// behind it, so closing the tab used to end her hosting permanently - and with
// nobody able to advance the game, that ends the night for everyone, not just
// her. So the moment a host link is confirmed against a real game, this browser
// writes the key down, and the start screen offers it back as "Resume hosting".
//
// Only ever written after the key has actually matched a game, so a mistyped or
// stale link can never be saved and offered back as if it were real.
export function readSavedHostKey() {
  return readStored(STORAGE_HOST)
}

export function forgetSavedHostKey() {
  writeStored(STORAGE_HOST, null)
}

// Send this browser to a host link. `replace` rather than assign, for the same
// reason `StartScreen` does it when creating a game: leaving the plain address
// in history means one reflex swipe back drops her out of being the host.
export function goToHostLink(key) {
  window.location.replace(window.location.pathname + '?host=' + key)
}

export function useGame() {
  const [game, setGame] = useState(null)
  const [gameId, setGameId] = useState(null)
  const [meId, setMeId] = useState(() => readStored(STORAGE_PLAYER))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 'connecting' | 'live' | 'dropped'
  const [connection, setConnection] = useState('connecting')

  const hostKey = hostKeyFromUrl()
  const isHost = Boolean(hostKey)

  // Guards against a slow reload landing after a newer one.
  const loadCounter = useRef(0)

  // How many of OUR OWN writes are in the air right now.
  //
  // A local change is shown before the database has confirmed it, so for a few
  // hundred milliseconds this browser is deliberately ahead of the server. If
  // somebody else's answer arrives in that window, its realtime message would
  // trigger a reload that fetches a server which has not yet heard about our
  // change - and the screen would jump BACK to the question we just left,
  // before jumping forward again when our write finally lands.
  //
  // So other people's messages are ignored while we have a write outstanding.
  // Nothing is lost: the reload at the end of our own write reads every table,
  // so whatever they did arrives a moment later anyway.
  const writesInFlight = useRef(0)

  const beginWrite = useCallback(() => {
    writesInFlight.current += 1
  }, [])

  const endWrite = useCallback(() => {
    writesInFlight.current = Math.max(0, writesInFlight.current - 1)
  }, [])

  const reload = useCallback(async (id) => {
    const targetId = id || gameId
    if (!targetId) return

    const ticket = ++loadCounter.current
    // `hostKey` decides whether the answer key comes back with the game - and
    // now the DATABASE checks it too (`rpc_load_full_game`), not just this
    // file's own judgement. It is derived from the `?host=` link, not from
    // anything stored in the browser, so a player cannot ask for the answers
    // by editing their own storage.
    const { data, error: loadError } = await loadFullGame(targetId, { hostKey })

    // A newer reload already finished, so throw this stale result away.
    if (ticket !== loadCounter.current) return

    if (loadError) {
      setError(loadError)
      return
    }
    setError(null)
    setGame(recomputeScores(data))
  }, [gameId, hostKey])

  // --- Showing a change before the database has confirmed it ---------------
  //
  // Every write used to redraw only after the round trip to Sydney AND a full
  // reload behind it, so a tap took two round trips to show anything. On a
  // phone on party wifi that is most of a second of a button looking broken,
  // and the honest response to that is to tap it again.
  //
  // So the change is applied here first, locally, and the screen moves at once.
  // The write still goes out, still reloads behind it, and still wins if the
  // two disagree - but none of that is in the way of the person tapping.
  //
  // Deliberately NOT a general-purpose cache: it holds only the same shape the
  // reload produces, and any error path calls `reload` to throw it away. The
  // database stays the source of truth; this only decides when the screen is
  // allowed to believe it.
  const patchGame = useCallback((patch) => {
    setGame((current) => {
      if (!current) return current
      return recomputeScores(typeof patch === 'function' ? patch(current) : { ...current, ...patch })
    })
  }, [])

  // --- Work out which game we are in, once, on startup ---------------------
  useEffect(() => {
    let cancelled = false

    async function start() {
      setLoading(true)

      // 1. Host link wins: ?host=<key>
      if (hostKey) {
        const { data, error: findError } = await findGameByHostKey(hostKey)
        if (cancelled) return

        if (findError) {
          setError(findError)
          setLoading(false)
          return
        }
        if (!data) {
          // Only forget the saved key if it is THIS dead one. She may be
          // opening a stale link while still holding a perfectly good saved
          // key for the live game, and wiping that would destroy the very
          // lifeline this exists to provide.
          if (readStored(STORAGE_HOST) === hostKey) writeStored(STORAGE_HOST, null)
          setError('That host link does not match any case. Check the link, or open a new one.')
          setLoading(false)
          return
        }
        // Confirmed against a real game, so it is safe to write down.
        writeStored(STORAGE_HOST, hostKey)
        setGameId(data.id)
        await reload(data.id)
        setLoading(false)
        return
      }

      // 2. Otherwise, try to rejoin whatever this browser was last in.
      //
      // A game that has been deleted or cleared away has to be FORGOTTEN here,
      // not merely reported. Without this the dead id sits in localStorage for
      // good and every single visit to the landing page re-reads it, re-fails
      // and re-shows "That game no longer exists." over the sign-in card - a
      // permanent error about a game that ended, on the one screen that is
      // supposed to be the way in. There was no way out of it but clearing
      // site data, which nobody should have to know how to do.
      //
      // Only a select that succeeded and found no row counts (`missing`). A
      // network or database failure must NOT wipe the id, because it is not
      // evidence the game is gone - the same distinction the host-link branch
      // above already draws between `findError` and `!data`.
      //
      // Deliberately only on the way in, not inside `reload`. Mid-game a row
      // that momentarily reads as absent would otherwise throw every player
      // out of a live night and take their identity with them, and a landing
      // page poisoned for one visitor is a far smaller thing than that.
      const savedGame = readStored(STORAGE_GAME)
      if (savedGame) {
        // This branch is the non-host way in, so no host key is offered - and
        // even if a stale one were somehow sitting in memory here, the
        // database itself now checks it against THIS game before handing
        // back anything secret, so passing the wrong key could not leak
        // another game's answers either.
        const { data, missing, error: loadError } = await loadFullGame(savedGame, {
          hostKey: null,
        })
        if (cancelled) return

        if (missing) {
          writeStored(STORAGE_GAME, null)
          // The player id goes too. It only means anything inside the game it
          // was issued for, and leaving it behind lets a dead identity turn up
          // against whatever game this browser joins next.
          writeStored(STORAGE_PLAYER, null)
          setLoading(false)
          return
        }

        setGameId(savedGame)
        if (loadError) setError(loadError)
        else setGame(recomputeScores(data))
        setLoading(false)
        return
      }

      // 3. Nothing to go on - the join screen will ask for a room code.
      if (!cancelled) setLoading(false)
    }

    start()
    return () => {
      cancelled = true
    }
    // Runs once on mount. hostKey comes from the URL and cannot change without
    // a page load, so this genuinely only needs to happen a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Listen for changes from anyone else ---------------------------------
  useEffect(() => {
    if (!gameId) return

    const unsubscribe = subscribeToGame(
      gameId,
      () => {
        // Not while one of our own writes is still in the air - see
        // `writesInFlight`. That write's own reload will pick this up too.
        if (writesInFlight.current > 0) return
        reload(gameId)
      },
      (status) => {
        if (status === 'SUBSCRIBED') setConnection('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('dropped')
        }
      },
    )

    return unsubscribe
  }, [gameId, reload])

  // --- Safety net ----------------------------------------------------------
  // If the realtime connection drops, fall back to checking every few seconds
  // so a stuck screen still catches up rather than freezing for the evening.
  useEffect(() => {
    if (connection !== 'dropped' || !gameId) return

    const timer = setInterval(() => reload(gameId), 4000)
    return () => clearInterval(timer)
  }, [connection, gameId, reload])

  // --- Joining -------------------------------------------------------------

  // Look up a game by its room code and remember it in this browser.
  const enterRoom = useCallback(async (roomCode) => {
    const { data, error: findError } = await findGameByRoomCode(roomCode)
    if (findError) return { error: findError }
    if (!data) return { error: "No game with that room code. Check it and try again." }

    setGameId(data.id)
    writeStored(STORAGE_GAME, data.id)
    await reload(data.id)
    return { gameId: data.id }
  }, [reload])

  // `forGameId` matters. Somebody who joins from the in-room join screen never
  // goes through enterRoom, so without this their browser remembers WHO they are
  // but not WHICH game - and the next refresh dumps them on the start screen
  // asking for a room code again, mid-party.
  const rememberMe = useCallback((playerId, forGameId) => {
    setMeId(playerId)
    writeStored(STORAGE_PLAYER, playerId)
    if (forGameId) writeStored(STORAGE_GAME, forGameId)
  }, [])

  // Forgetting has to clear the room held in MEMORY as well as the one in
  // storage. Clearing only storage left the app still showing the room you were
  // trying to escape, with nothing on screen but "take your seat" - which made
  // "Wrong room?" a dead end instead of the way out of one.
  //
  // The saved HOST key is deliberately left alone here. This is the guest
  // "wrong room?" escape; host identity is a separate thing entirely, and
  // quietly binning her way back into the game as a side effect of a guest
  // action is exactly the kind of silent loss this whole mechanism exists to
  // prevent.
  const forgetMe = useCallback(() => {
    setMeId(null)
    setGameId(null)
    setGame(null)
    writeStored(STORAGE_PLAYER, null)
    writeStored(STORAGE_GAME, null)
  }, [])

  // Am I actually still in this game? Covers the case where the game was reset
  // but this browser still remembers an old player id.
  const meIsInGame = Boolean(game && meId && game.players.some((p) => p.id === meId))

  return {
    game,
    gameId,
    setGameId,
    loading,
    error,
    setError,
    connection,
    isHost,
    hostKey,
    meId,
    meIsInGame,
    reload,
    patchGame,
    beginWrite,
    endWrite,
    enterRoom,
    rememberMe,
    forgetMe,
  }
}
