import { useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBanner, Screen } from '../ui.jsx'
import { createGame, findGameByHostKey, findGameByRoomCode } from '../db.js'
import { readSavedHostKey, forgetSavedHostKey, goToHostLink } from '../useGame.js'
import { pickCaseNotes } from '../caseNotes.js'
import { CaseBoard, CaseBoardMobile, Hero, CardPin, Label } from './CaseBoard.jsx'
import { useViewport, fitBoard } from '../viewportFit.js'

// ---------------------------------------------------------------------------
// THE SIGN-IN SCREEN. The very first screen, before we know which game you
// are in.
//
// Two doors:
//   Players type their name and the case number the host reads out.
//   The host opens a new case, which sends them to a private host link.
//
// This file holds the FORM - the room-code lookup, the host-resume flow, the
// sign-in card's own state and handlers. How the landing board itself is
// drawn (two separate design bundles, desktop and phone, sharing one set of
// pieces) lives in `CaseBoard.jsx`, which this file imports from - read that
// file's header comment for the board mechanics. How each board is fitted to
// a real window lives in `viewportFit.js`. This file is about what happens
// before and after somebody presses a button.
//
// THE PROBLEM THIS SCREEN HAS, AND HOW IT IS SOLVED
//
// The hero is the guest of honour's name. But this screen runs BEFORE the app
// knows which game anyone is joining, so there is no name to put there. It is
// the one screen in the app that has to work knowing nothing.
//
// So the hero starts on a line that works with nothing - "SOMEONE / YOU KNOW",
// which is the design's own placeholder too - and fills in the real name the
// moment a complete case number is typed. `findGameByRoomCode` already existed
// for this; the lookup is one query, fired only on a full-length code, and a
// failure is silent because a half-typed code is not an error, it is somebody
// still typing.
// ---------------------------------------------------------------------------

// Room codes are five characters. Below that there is nothing worth looking up.
const CODE_LENGTH = 5

// What the hero says before it knows whose case this is. It has to read as a
// deliberate pulp line rather than as a blank, because for most of the time
// anyone spends on this screen, this is what they are looking at.
const UNKNOWN_SUBJECT = 'Someone you know'

// The evidence notes sit in fixed slots with fixed gaps beneath them, so a
// long one would run into the piece below it. The pool's longest entries are
// two lines taller than the design's own, so the board draws from the short
// half of it. Nothing is truncated; entries that would not fit are simply not
// offered to this screen.
const NOTE_MAX_CHARS = 60

// ---------------------------------------------------------------------------
// THE SCREEN
// ---------------------------------------------------------------------------

export default function StartScreen({ error, busy, onEnterRoom, onJoin, onClearError }) {
  const [roomCode, setRoomCode] = useState('')
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')
  const [creating, setCreating] = useState(false)
  const codeInput = useRef(null)

  // The name found by looking up a complete case number. Null until then.
  const [discovered, setDiscovered] = useState(null)

  // The host's way back in after closing the tab. Held in state rather than read
  // on every render so that when the game behind it turns out to be gone, the
  // button can disappear and the explanation can appear in the same breath.
  const [savedHostKey, setSavedHostKey] = useState(() => readSavedHostKey())
  const [resuming, setResuming] = useState(false)

  // Kept separate from `localError`, which renders inside the sign-in card. A
  // resume failure removes the resume panel, so its explanation has to be able
  // to outlive it and stay where the button was - otherwise the button simply
  // vanishes under the host's thumb with no reason given.
  const [resumeNotice, setResumeNotice] = useState('')

  // Whether the game behind the saved key has finished, so the button can say
  // which it is. It used to read "Your case is still open" for a game that had
  // reached its closing scoreboard hours earlier - the second audit clicked it
  // on a finished game and landed on the final standings. Null while unknown
  // (and if the lookup fails), which the label falls back to safely.
  const [savedGameFinished, setSavedGameFinished] = useState(null)

  useEffect(() => {
    if (!savedHostKey) return

    let cancelled = false
    findGameByHostKey(savedHostKey).then(({ data, error: lookupError }) => {
      // A failure here means nothing either way, so it is swallowed: the panel
      // keeps its neutral wording and `handleResumeHosting` does the real check
      // when the host actually presses it.
      if (cancelled || lookupError || !data) return
      setSavedGameFinished(data.status === 'finished')
    })

    return () => {
      cancelled = true
    }
  }, [savedHostKey])

  const viewport = useViewport()
  const fit = fitBoard(viewport)

  const cleanCode = roomCode.trim().toUpperCase()

  // The board is seeded on the case number, so once you have typed a real one
  // the board settles and stops changing under you. Before that it is seeded on
  // nothing, which is stable for the life of the mount.
  const notes = useMemo(
    () => pickCaseNotes(cleanCode.length === CODE_LENGTH ? cleanCode : '', 5, NOTE_MAX_CHARS),
    [cleanCode],
  )

  // Look the case number up as soon as it is long enough, so the hero can name
  // the subject before anybody presses anything.
  //
  // Deliberately quiet: a code that matches nothing clears the name and says
  // nothing at all. Somebody halfway through typing has not made a mistake, and
  // telling them off for it on every keystroke would be unbearable.
  useEffect(() => {
    if (cleanCode.length !== CODE_LENGTH) {
      setDiscovered(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await findGameByRoomCode(cleanCode)
      if (cancelled) return
      setDiscovered(data?.subject_name?.trim() || null)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cleanCode])

  const subjectName = discovered || UNKNOWN_SUBJECT
  const nameIsKnown = Boolean(discovered)

  async function handleGo() {
    const cleanName = name.trim()

    if (cleanName === '') {
      setLocalError('Please type your name so everyone knows who you are.')
      return
    }
    if (cleanCode === '') {
      setLocalError('Please type the case number the host shared with you.')
      return
    }
    setLocalError('')
    onClearError()

    const foundGameId = await onEnterRoom(cleanCode)
    if (!foundGameId) return // the error banner explains why

    await onJoin(cleanName, foundGameId)
  }

  // Back into the game the host was already running. The key is checked against
  // the database BEFORE we navigate, because sending them to a dead host link
  // would land them on the app's "that link does not match any game" error with
  // the dead key now sitting in the address bar - a worse place to be stuck
  // than the screen they started on.
  async function handleResumeHosting() {
    setResuming(true)
    setResumeNotice('')
    setLocalError('')
    onClearError()

    const { data, error: findError } = await findGameByHostKey(savedHostKey)
    setResuming(false)

    // A network or database failure is NOT proof the game is gone, so the saved
    // key stays put and they can simply try again in a moment.
    if (findError) {
      setResumeNotice(findError)
      return
    }
    if (!data) {
      forgetSavedHostKey()
      setSavedHostKey(null)
      setResumeNotice(
        'That game has finished or been cleared away, so there is nothing to go back to. Open a new case below.',
      )
      return
    }
    goToHostLink(savedHostKey)
  }

  // Creates a fresh game and moves to the private host link. That link is the
  // only thing that makes someone the host, so it must not be shared.
  async function handleCreate() {
    setCreating(true)
    setLocalError('')
    const { data, error: createError } = await createGame()
    setCreating(false)

    if (createError) {
      setLocalError(createError)
      return
    }
    // REPLACE, not assign. Setting `location.search` leaves the plain address
    // sitting in the browser's history, so one reflex swipe back took the host
    // out of being the host mid-game and showed them the guest screen - from
    // where the obvious thing to press starts a whole new empty game and
    // abandons the live one. Replacing the entry means there is nothing to go
    // back to.
    window.location.replace(window.location.pathname + '?host=' + data.host_key)
  }

  // The sign-in card. Defined here rather than at module scope because it is
  // the one piece of the board made of live controls rather than of paper, and
  // it needs every one of this component's handlers.
  //
  // `m` drops the submit button: the phone bundle lifts it out of the card
  // entirely and pins it to the floor of the screen as a floating CTA, so it is
  // reachable without scrolling 2400px of board first.
  const reportForDuty = (m = false) => (
    <div
      className="relative bg-paper text-ink"
      style={{
        padding: m ? '16px 18px 18px' : '20px 24px 22px',
        transform: 'rotate(' + (m ? 0.7 : 0.6) + 'deg)',
        boxShadow: '10px 12px 0 rgba(0,0,0,0.5)',
        borderTop: '8px solid var(--color-red)',
      }}
    >
      <CardPin at={m ? 254 : undefined} tone="bone" />
      <div
        className="font-impact whitespace-nowrap uppercase"
        style={{ fontSize: (m ? 19 : 22) + 'px', letterSpacing: '-0.02em' }}
      >
        Report for duty
      </div>

      {/* The host's way back in, and deliberately at the TOP of this card. It
          only ever renders on a browser that has genuinely hosted a real game,
          so no guest ever sees it. It sits this high because of when it gets
          used: the host's tab has closed mid-party and the room is waiting.
          Making them hunt for it - past a button that would abandon the live
          game and start an empty one - is the wrong shape for a panic. */}
      {(savedHostKey || resumeNotice) && (
        <div className="mt-3">
          {savedHostKey ? (
            <button
              type="button"
              onClick={handleResumeHosting}
              disabled={resuming}
              className="focus-ring flex w-full items-center justify-between bg-red font-mono
                         font-bold uppercase text-bone disabled:opacity-50"
              style={{
                padding: m ? '10px 12px' : '7px 10px',
                fontSize: '9.5px',
                letterSpacing: '0.16em',
              }}
            >
              {resuming
                ? 'Checking…'
                : savedGameFinished
                  ? 'Reopen your closed case'
                  : 'Your case is still open'}
              <span aria-hidden="true">&rarr;</span>
            </button>
          ) : (
            <div
              className="font-mono font-bold uppercase text-red-deep"
              style={{ fontSize: '9.5px', letterSpacing: '0.16em' }}
            >
              That case is closed
            </div>
          )}
          {resumeNotice && (
            <p className="mt-1.5 font-body text-[12.5px] leading-snug text-ink-soft">
              {resumeNotice}
            </p>
          )}
        </div>
      )}

      {(error || localError) && (
        <div className="mt-3">
          <ErrorBanner message={error || localError} />
        </div>
      )}

      <Label
        className="text-red-deep"
        size={8.5}
        tracking="0.22em"
        style={{ marginTop: m ? '15px' : '16px' }}
      >
        Name on the badge
      </Label>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && handleGo()}
        placeholder="MORGAN"
        maxLength={20}
        aria-label="Your name"
        className="focus-ring w-full border-0 border-b-2 border-red bg-transparent p-0
                   font-impact uppercase text-ink placeholder:text-ink-dashed"
        style={{
          marginTop: m ? '4px' : '5px',
          height: (m ? 46 : 42) + 'px',
          fontSize: (m ? 24 : 25) + 'px',
        }}
      />

      <Label
        className="text-red-deep"
        size={8.5}
        tracking="0.22em"
        style={{ marginTop: m ? '15px' : '16px' }}
      >
        Case number
      </Label>

      {/* Both designs draw the case number as a row of boxed characters, which
          is a display rather than a control. So it IS a display: five cells
          rendered from the current value, with one real input stretched
          invisibly across them. Tapping anywhere focuses the input, typing fills
          the cells, and a screen reader still meets a single labelled text field
          rather than five mystery boxes.

          Five, not the designs' six: a room code is five characters, and a sixth
          box nobody can ever fill is an instruction to type something that does
          not exist. */}
      <div
        className="relative"
        style={{ marginTop: '6px' }}
        onClick={() => codeInput.current?.focus()}
        role="presentation"
      >
        <div className="flex gap-1.5">
          {Array.from({ length: CODE_LENGTH }, (_, index) => {
            const char = cleanCode[index]
            return (
              <div
                key={index}
                className={
                  'flex flex-1 items-center justify-center font-mono font-bold ' +
                  (char
                    ? 'border-2 border-ink text-ink'
                    : 'border-2 border-dashed border-ink-dashed text-ink-dashed')
                }
                style={{ height: (m ? 46 : 42) + 'px', fontSize: (m ? 19 : 19) + 'px' }}
              >
                {char || '·'}
              </div>
            )
          })}
        </div>
        <input
          ref={codeInput}
          type="text"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => event.key === 'Enter' && handleGo()}
          maxLength={CODE_LENGTH}
          aria-label="Case number"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          className="focus-ring absolute inset-0 h-full w-full bg-transparent text-center
                     font-mono tracking-[0.6em] text-transparent caret-red"
          style={{ fontSize: (m ? 19 : 19) + 'px' }}
        />
      </div>

      {!m && (
        <button
          type="button"
          onClick={handleGo}
          disabled={busy}
          className="focus-ring mt-4 flex h-[58px] w-full items-center justify-between bg-red
                     px-4 font-impact uppercase text-bone hover:bg-red-deep disabled:opacity-50"
          style={{ fontSize: '19px' }}
        >
          {busy ? 'Taking the case…' : 'Take the case'}
          <span className="font-mono" style={{ fontSize: '19px' }} aria-hidden="true">
            &rarr;
          </span>
        </button>
      )}

      {/* MOBILE ONLY. On desktop this card is a fixed-canvas piece pinned at
          one spot on the board (`HostPiece`, placed on its own below the
          statement note) - Snehin's call, after this same "OR / start as
          host" block living HERE made the card tall enough, tall enough at
          the wrong moment, to twice run past the board's edge
          (`HANDOFF-19.md`). A scrollable fallback fixed the symptom; a card
          whose height nothing else depends on fixes the actual problem. On
          a phone there is no fixed canvas to run past - the board already
          scrolls as a matter of course - so the extra option stays here,
          in the one card a new visitor actually reads. */}
      {m && (
        <div className="mt-4" style={{ marginTop: '18px' }}>
          <div className="flex items-center gap-2.5">
            <div className="h-px flex-1 bg-ink/20" />
            <span
              className="font-mono font-bold text-ink-faint"
              style={{ fontSize: '9.5px', letterSpacing: '0.2em' }}
            >
              OR
            </span>
            <div className="h-px flex-1 bg-ink/20" />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="focus-ring mt-3 flex w-full items-center justify-between border-2
                       border-red bg-transparent px-4 font-impact uppercase text-red-deep
                       hover:bg-red hover:text-bone disabled:opacity-50"
            style={{ height: '50px', fontSize: '16px' }}
          >
            {creating ? 'Opening…' : 'Running it yourself? Start as host'}
            <span className="font-mono" style={{ fontSize: '16px' }} aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
      )}
    </div>
  )

  if (fit) {
    return (
      <Screen
        status={false}
        fixed
        pad={false}
        footer={{
          // Used to repeat "Running it yourself? Open a case" here too - the
          // one obvious way to host now lives on the board itself, as its
          // own piece (`HostPiece`), and a second copy of it tucked into the
          // footer corner was exactly the "hidden in the corner" problem
          // Snehin pointed out, not a helpful fallback.
          left: 'No account · no app · no mercy',
        }}
      >
        <CaseBoard
          fit={fit}
          notes={notes}
          creating={creating}
          onCreate={handleCreate}
          hero={
            <Hero subjectName={subjectName} nameIsKnown={nameIsKnown} code={cleanCode || null} />
          }
          reportForDuty={reportForDuty(false)}
        />
      </Screen>
    )
  }

  return (
    <Screen status={false} fixed pad={false}>
      <CaseBoardMobile
        width={viewport.w}
        notes={notes}
        code={cleanCode}
        busy={busy}
        onGo={handleGo}
        hero={<Hero subjectName={subjectName} nameIsKnown={nameIsKnown} m pin={234} />}
        reportForDuty={reportForDuty(true)}
      />
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// THE DESKTOP BOARD
//
// One scaled layer. Every `at()` below is the design file's own coordinate,
// shifted only by which of the three clusters the piece belongs to. Nothing
// here is tuned by eye: if a piece looks wrong, check it against
// `Main Page - Do You Know Them.dc.html` rather than nudging the number.
// ---------------------------------------------------------------------------

