import { useState, useEffect, useRef } from 'react'
import { useGame, forgetSavedHostKey } from './useGame.js'
import * as db from './db.js'
import {
  findQuestion,
  activeCategories,
  activePlayers,
  categoryLosers,
  questionsInCategory,
  findCategory,
  currentCategory,
  nextQuestionInCategory,
  firstQuestionOfNextCategory,
  votesForQuestion,
  answersForQuestion,
  cardsPlayedOn,
  autoLevellingTarget,
} from './gameHelpers.js'
import {
  roundTypeFor,
  JUDGE_MODES,
  scoreClosestGuess,
  scoreRanking,
  scoreFibbage,
  fibbageOptions,
  publishVoteOptions,
  voteMapFor,
} from './roundTypes.js'
import { POWER_UPS, LOSER_SUPPORT, dealCards, dealOne, findCard } from './powerUps.js'
import { maxQuestionsFor } from './questionBank.js'

import { subjectFrom } from './subject.js'
import { SubjectContext } from './subjectContext.js'
import { supabaseConfigError } from './supabaseClient.js'
import ErrorBoundary from './ErrorBoundary.jsx'
import ConnectionBanner from './components/ConnectionBanner.jsx'
import LeaveButton from './components/LeaveButton.jsx'
import LoadingScreen from './screens/LoadingScreen.jsx'
import GameRouter from './screens/GameRouter.jsx'
import StartScreen from './screens/StartScreen.jsx'


// ---------------------------------------------------------------------------
// App - decides which screen to show, and is the only place that changes the
// game. Every handler writes to Supabase, then reloads so the change appears
// immediately rather than waiting for the realtime message to come back round.
//
// THE STATE MACHINE
//
//   setup -> lobby -> [ for each category, for each question:
//                         (bidding) -> question_open -> (voting) -> judging
//                         -> reveal ]
//                    -> category_results -> next category ... -> finished
//
//   bidding  only for The Auction  (bid before you see the question)
//   voting   only for Fibbage Flip (everyone guesses which answer is true)
//   judging  skipped when the round scores itself
// ---------------------------------------------------------------------------

function startingStatusFor(question) {
  return roundTypeFor(question).needsBidding ? 'bidding' : 'question_open'
}

// The answer list with a batch of freshly worked-out points laid over it, for
// showing a self-scoring round's result the moment it is worked out rather than
// after the database has been told about it.
function withPoints(answers, pointsByAnswerId) {
  return answers.map((answer) =>
    answer.id in pointsByAnswerId
      ? { ...answer, pointsAwarded: pointsByAnswerId[answer.id] }
      : answer,
  )
}

// The same idea for one question's own fields - her ranking, her number, her
// real answer.
function withQuestionFields(questions, questionId, fields) {
  return questions.map((question) =>
    question.id === questionId ? { ...question, ...fields } : question,
  )
}

// And for one player's answer, keyed by who wrote it rather than by row id,
// because the row may not exist yet the first time they submit.
function withMyAnswer(answers, questionId, playerId, fields) {
  const existing = answers.find((a) => a.questionId === questionId && a.playerId === playerId)
  if (existing) {
    return answers.map((a) => (a === existing ? { ...a, ...fields } : a))
  }
  // A placeholder id, replaced by the real row on the very next reload. It
  // never reaches the database and nothing scores off it, because an unjudged
  // answer contributes nothing until the guest of honour rules on it.
  return [...answers, { id: 'pending:' + questionId + ':' + playerId, questionId, playerId, pointsAwarded: null, ...fields }]
}

export default function App() {
  const {
    game,
    gameId,
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
  } = useGame()

  const [busy, setBusy] = useState(false)

  // Entering a room and joining it are two writes, but one act as far as the
  // person doing it is concerned. This covers both, so the moment between them
  // - room found, player row not created yet - cannot render anything.
  const [joining, setJoining] = useState(false)

  // Round lengths she has tapped that the database has not caught up with yet.
  // Cleared per round as reality matches, so a slow write shows the number she
  // asked for rather than snapping back and forth.
  const [pendingCounts, setPendingCounts] = useState({})

  useEffect(() => {
    if (!game) return
    setPendingCounts((pending) => {
      const stillPending = {}
      let changed = false
      Object.keys(pending).forEach((categoryId) => {
        if (questionsInCategory(game, categoryId).length === pending[categoryId]) changed = true
        else stillPending[categoryId] = pending[categoryId]
      })
      return changed ? stillPending : pending
    })
  }, [game])

  // Every write goes through here so a failure always ends up on screen
  // instead of disappearing silently.
  //
  // `optimistic` is what the game will look like once the write lands. It is
  // applied to local state IMMEDIATELY, so the screen responds to the tap
  // rather than to the network. The write still goes out and the reload behind
  // it is still authoritative - if they disagree, the database wins.
  //
  // A failed write reloads before showing the error, so an optimistic change
  // that turned out to be a lie is taken back off the screen rather than left
  // sitting there looking real.
  //
  // `busy` is now cleared AFTER the reload, not before it. It used to clear
  // first, which left a window where the buttons were live again while `game`
  // was still the pre-write snapshot - two quick taps then both acted on stale
  // state. That is what dealt a duplicate question in the setup stepper.
  async function run(action, optimistic) {
    if (optimistic) patchGame(optimistic)
    setBusy(true)
    beginWrite()

    let result
    try {
      result = await action()
    } finally {
      // Released before the reload, so the reload below is the one that
      // reconciles - and a thrown error can never leave the counter stuck,
      // which would silently deafen this browser to everyone else for the
      // rest of the night.
      endWrite()
    }

    if (result && result.error) {
      // ORDER MATTERS. The reload takes the optimistic change back off the
      // screen, and a successful reload clears `error` as part of its job - so
      // setting the message first meant the reload wiped it, and a failed save
      // rolled back in complete silence. Roll back, THEN say why.
      await reload()
      setError(result.error)
      setBusy(false)
      return false
    }

    setError(null)
    await reload()
    setBusy(false)
    return true
  }

  // -------------------------------------------------------------------------
  // Joining
  // -------------------------------------------------------------------------

  // THE FLASH OF THE JOIN SCREEN, and why this sets `joining`.
  //
  // From the start screen these two run back to back: find the room, then join
  // it. Finding the room sets `game`, which is enough for the app to stop
  // showing the start screen and start showing the game - and at that instant
  // the player has no row in it yet, so the first thing it picked was the
  // in-room "what's your name?" screen. The name they had *just typed*, asked
  // for again, for a fraction of a second, before the lobby appeared.
  //
  // `joining` stays true across both steps so that in-between moment renders as
  // the loading screen it actually is.
  async function handleEnterRoom(roomCode) {
    setJoining(true)
    setBusy(true)
    const result = await enterRoom(roomCode)
    setBusy(false)

    if (result.error) {
      setJoining(false)
      setError(result.error)
      return false
    }
    return result.gameId
  }

  async function handleJoin(displayName, resolvedGameId) {
    const targetId = resolvedGameId || gameId
    setJoining(true)
    setBusy(true)
    const { data, error: joinError } = await db.joinGame(targetId, displayName)
    setBusy(false)

    if (joinError) {
      setJoining(false)
      setError(joinError)
      return false
    }
    // The room id goes in alongside the player id. Joining from the in-room
    // screen never passes through enterRoom, so without this the browser knows
    // who you are but not which game - and the next refresh drops you back on
    // the "type a room code" poster in the middle of the party.
    rememberMe(data.id, targetId)
    setError(null)
    await reload(targetId)
    setJoining(false)
    return true
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  const toggleCategory = (categoryId) => {
    const category = game.categories.find((c) => c.id === categoryId)
    const included = !category.included
    return run(() => db.setCategoryIncluded(gameId, hostKey, categoryId, included), {
      categories: game.categories.map((c) => (c.id === categoryId ? { ...c, included } : c)),
    })
  }

  // How many questions a round asks.
  //
  // The number on screen follows the thumb, not the network. The write sends an
  // ABSOLUTE target rather than "one more", which is what makes that safe: two
  // taps in quick succession send "4" and then "5", and whichever order they
  // reach the database it settles on 5. Nothing accumulates twice, and no tap
  // has to be thrown away to keep it correct.
  //
  // Which questions are already dealt is still read from the database inside
  // the write, so the draw can never repeat one.
  //
  // AND THE WRITES FOR ONE ROUND ARE CHAINED, NOT FIRED IN PARALLEL. The target
  // above is absolute, but the write that applies it is a read-modify-write: it
  // reads how many questions are already dealt and inserts the difference. Two
  // of those in flight at once BOTH read the old count and BOTH insert the
  // difference, so the round ends up longer than either tap asked for. Found on
  // 4 September by holding the "+" key down on a round capped at fifteen and
  // finding seventeen questions in the database - the cap was correct in the UI
  // and correct in the write, and the two writes still raced past it.
  //
  // Chaining per category is what makes the "whichever order they reach the
  // database it settles on the last one" reasoning above actually true.
  const questionWrites = useRef(new Map())

  const setQuestionCount = (categoryId, count) => {
    const category = findCategory(game, categoryId)
    if (!category) return

    const target = Math.max(1, Math.min(maxQuestionsFor(category.type), count))
    setPendingCounts((pending) => ({ ...pending, [categoryId]: target }))

    const queued = (questionWrites.current.get(categoryId) || Promise.resolve())
      // A failed write must not wedge the queue for the rest of the night.
      .catch(() => {})
      .then(() => db.setCategoryQuestionCount(gameId, hostKey, category, target))

    questionWrites.current.set(categoryId, queued)
    return run(() => queued)
  }

  const setPowerUpTier = (tier) =>
    run(() => db.updateGame(gameId, hostKey, db.gameFieldsToRow({ powerUpTier: tier })))

  // -------------------------------------------------------------------------
  // Timers - host only. Every client renders its own countdown from
  // `game.timerEndsAt` (see `useCountdown.js`), so these three writes are the
  // whole of it: set the timestamp, push it further out, or clear it.
  // -------------------------------------------------------------------------
  const startTimer = (seconds) => {
    const timerEndsAt = new Date(Date.now() + seconds * 1000).toISOString()
    return run(() => db.startTimer(gameId, hostKey, seconds), { timerEndsAt })
  }

  const extendTimer = (seconds) => {
    const base = game.timerEndsAt ? new Date(game.timerEndsAt).getTime() : Date.now()
    const timerEndsAt = new Date(Math.max(base, Date.now()) + seconds * 1000).toISOString()
    return run(() => db.extendTimer(gameId, hostKey, game.timerEndsAt, seconds), { timerEndsAt })
  }

  const clearTimer = () => run(() => db.clearTimer(gameId, hostKey), { timerEndsAt: null })

  // The bank is a starting point, not the point. A host who knows their friend
  // can add a question of their own to any round, edit one already dealt in
  // place, or remove a specific one they do not like - all three on top of the
  // bank draws above, not instead of them.
  const addOwnQuestion = (categoryId, input) => {
    const category = findCategory(game, categoryId)
    if (!category) return
    const existingOrderIndexes = questionsInCategory(game, categoryId).map((q) => q.orderIndex)
    return run(() => db.addOwnQuestion(gameId, hostKey, category, { ...input, existingOrderIndexes }))
  }

  const editQuestion = (questionId, fields) =>
    run(() => db.setQuestionFields(gameId, hostKey, questionId, db.questionFieldsToRow(fields)))

  // A round always needs at least one question - the same floor the stepper
  // holds itself to - so removing the last one is refused rather than leaving
  // a round with nothing to play.
  const removeQuestion = (questionId) => {
    const question = findQuestion(game, questionId)
    if (!question) return
    const remaining = questionsInCategory(game, question.categoryId).length
    if (remaining <= 1) return
    return run(() => db.removeQuestion(gameId, hostKey, questionId))
  }

  // Who tonight is about. Saved as one patch so the name and the pronouns
  // cannot end up half-applied, and safe to call at any point during setup:
  // questions are stored with their {name} tokens intact and filled in on
  // load, so renaming re-reads every question already dealt. Nothing needs
  // rewriting and nothing needs re-dealing.
  const setSubject = (fields) =>
    run(() => db.updateGame(gameId, hostKey, db.gameFieldsToRow(fields)))

  const toggleLoserSupport = () =>
    run(() =>
      db.updateGame(gameId, hostKey, db.gameFieldsToRow({ loserSupportEnabled: !game.loserSupportEnabled })),
    )

  // Moving the game to another screen. Applied locally first, so the screen
  // changes on the tap - this is the single most-pressed control in the night
  // and the one that most needs to feel immediate.
  const setStatus = (status, extra = {}) =>
    run(() => db.updateGame(gameId, hostKey, db.gameFieldsToRow({ status, ...extra })), { status, ...extra })

  const openLobby = () => setStatus('lobby')
  const backToEditor = () => setStatus('setup')

  function startGame() {
    const categories = activeCategories(game)
    if (categories.length === 0) return
    const first = questionsInCategory(game, categories[0].id)[0]
    if (!first) return
    return dealForQuestion(categories[0].id).then(() =>
      setStatus(startingStatusFor(first), { currentQuestionId: first.id }),
    )
  }

  // -------------------------------------------------------------------------
  // Moving the game along
  // -------------------------------------------------------------------------

  const lockBids = () => setStatus('question_open')

  // Answers are in. Fibbage goes to a vote; everything else goes to judging,
  // and self-scoring rounds do their maths on the way through.
  async function lockAnswers() {
    const question = findQuestion(game, game.currentQuestionId)
    const roundType = roundTypeFor(question)

    // THE ALIBI: publish the ballot before opening the vote.
    //
    // The options have to be built somewhere that holds the true answer, which
    // is the host and only the host. Publishing them here means every player
    // votes on the same shuffled list, with ids that tell them nothing, and
    // the key to those ids travels with the answer key rather than with the
    // ballot. See `publishVoteOptions`.
    if (roundType.needsVoting) {
      const entries = answersForQuestion(game, question.id)
      const { ballot, voteMap } = publishVoteOptions(fibbageOptions(question, entries))

      return run(
        async () => {
          const published = await db.setQuestionFields(
            gameId,
            hostKey,
            question.id,
            db.questionFieldsToRow({ items: ballot, trueOrder: { voteMap } }),
          )
          if (published.error) return published
          return db.updateGame(gameId, hostKey, db.gameFieldsToRow({ status: 'voting' }))
        },
        {
          status: 'voting',
          questions: withQuestionFields(game.questions, question.id, {
            items: ballot,
            trueOrder: { voteMap },
          }),
        },
      )
    }

    const answers = answersForQuestion(game, question.id)
    let computed = null
    if (roundType.judgeMode === JUDGE_MODES.AUTO) {
      computed = scoreClosestGuess(question, answers)
    } else if (roundType.judgeMode === JUDGE_MODES.AUTO_MATCH) {
      computed = scoreRanking(question, answers, question.trueOrder)
    }

    if (!computed) return setStatus('judging')

    // ONE action, not two. Scoring and advancing used to be separate writes
    // with a separate reload each - four round trips for one tap, and a moment
    // in between where every device in the room could see the answers scored
    // but the screen not moved. If the second write then failed, the question
    // was stuck there.
    return run(
      async () => {
        const scored = await db.setManyAnswerPoints(gameId, hostKey, computed)
        if (scored.error) return scored
        return db.updateGame(gameId, hostKey, db.gameFieldsToRow({ status: 'judging' }))
      },
      { status: 'judging', answers: withPoints(game.answers, computed) },
    )
  }

  // Fibbage only: votes are in, so work out who fooled whom.
  //
  // ANYONE WHO VOTED BUT NEVER FILED A LIE GETS A SCORING SLOT FIRST. Two
  // points for spotting the real answer are earned by voting, not by writing,
  // and somebody can easily miss the writing half and still play the guessing
  // half. Every point in this app is stored against an answer row, so without
  // one those two points had nowhere to land: the second audit watched a player
  // pick the truth, be told "YOU FOUND THE TRUTH" in capitals on her own screen
  // and "Found by Ana" on the host's, and be paid nothing. The row is empty and
  // unsubmitted, so no "still waiting on" count moves and the reveal's list of
  // statements skips it.
  function lockVotes() {
    const questionId = game.currentQuestionId
    const question = findQuestion(game, questionId)
    const votes = votesForQuestion(game, questionId)

    const missing = votes
      .map((vote) => vote.playerId)
      .filter(
        (playerId) =>
          !game.answers.some((a) => a.questionId === questionId && a.playerId === playerId),
      )

    // ONE action, not three. The rows, the scores and the move to the reveal go
    // out together, so a failure part-way cannot leave the room looking at a
    // vote that has closed but not been counted.
    return run(
      async () => {
        let answers = answersForQuestion(game, questionId)

        if (missing.length > 0) {
          const made = await db.createEmptyAnswers(gameId, hostKey, questionId, missing)
          if (made.error) return made
          answers = [...answers, ...(made.data || []).map(db.answerFromRow)]
        }

        // Votes were cast against published ballot ids, so they have to be
        // translated back before anyone can be credited. Only the host holds
        // the map, and the host is the only one who runs this.
        const computed = scoreFibbage(answers, votes, voteMapFor(question))

        const scored = await db.setManyAnswerPoints(gameId, hostKey, computed)
        if (scored.error) return scored
        return db.updateGame(gameId, hostKey, db.gameFieldsToRow({ status: 'reveal' }))
      },
      // Shown straight away. The empty rows are not in this optimistic patch -
      // they arrive with the reload that follows - so a player who only voted
      // sees their two points a moment after everyone else sees theirs, rather
      // than not at all.
      { status: 'reveal' },
    )
  }

  const finishJudging = () => setStatus('reveal')

  // After the reveal: next question in this category, or the category results.
  function nextQuestion() {
    const next = nextQuestionInCategory(game)
    if (next) {
      // A Power-Up Quiz deals again for every question. `dealForQuestion`
      // ignores every other round type, so this costs nothing elsewhere.
      return dealForQuestion(next.categoryId).then(() =>
        setStatus(startingStatusFor(next), {
          currentQuestionId: next.id,
          winnerAnswerId: null,
        }),
      )
    }
    // Category over: work out who came last and give them something for the
    // round ahead, before anyone sees the results screen.
    const finished = currentCategory(game)
    const upcoming = firstQuestionOfNextCategory(game)
    return grantLoserSupport(finished?.id, upcoming?.categoryId).then(() =>
      setStatus('category_results', { winnerAnswerId: null }),
    )
  }

  // After the category leaderboard: on to the next category, or the end.
  function nextCategory() {
    const next = firstQuestionOfNextCategory(game)
    if (!next) return setStatus('finished')
    return dealForQuestion(next.categoryId).then(() =>
      setStatus(startingStatusFor(next), { currentQuestionId: next.id }),
    )
  }

  const endGame = () => setStatus('finished')

  // -------------------------------------------------------------------------
  // Host decisions during a round
  // -------------------------------------------------------------------------

  // Records one of the three verdicts against an answer. There is deliberately
  // no way to pass an arbitrary number here from the UI - the judging screen
  // only ever sends VERDICT_POINTS, so every judged answer in the game is worth
  // 0, 1 or 2 and nothing else.
  // She taps this once per answer, down a list of them, so it is the control
  // that most needs to answer the thumb instantly. The verdict lands locally
  // first and the write follows.
  const setPoints = (answerId, points) =>
    run(() => db.setAnswerPoints(gameId, hostKey, answerId, points), {
      answers: withPoints(game.answers, { [answerId]: points }),
    })

  // Sell It: one winner takes the points, everyone else gets nothing.
  function pickWinner(answerId) {
    const question = findQuestion(game, game.currentQuestionId)
    const prize = question ? question.points : 1

    const points = {}
    answersForQuestion(game, game.currentQuestionId).forEach((answer) => {
      points[answer.id] = answer.id === answerId ? prize : 0
    })

    // Crowning a winner is one decision, so it is one write. It used to be two,
    // which left a moment where the points were handed out but nobody was shown
    // as having won them.
    return run(
      async () => {
        const scored = await db.setManyAnswerPoints(gameId, hostKey, points)
        if (scored.error) return scored
        return db.updateGame(gameId, hostKey, db.gameFieldsToRow({ winnerAnswerId: answerId }))
      },
      { winnerAnswerId: answerId, answers: withPoints(game.answers, points) },
    )
  }

  // Her own answers, on the three rounds where she plays along and her answer
  // becomes the key. Shown locally at once - she has just committed to
  // something in front of the room and should see it land.
  const setQuestionField = (fields) =>
    run(() => db.setQuestionFields(gameId, hostKey, game.currentQuestionId, db.questionFieldsToRow(fields)), {
      questions: withQuestionFields(game.questions, game.currentQuestionId, fields),
    })

  const setTrueOrder = (order) => setQuestionField({ trueOrder: order })

  // Fibbage: the real answer, written live and shuffled in with the lies.
  const setTrueAnswer = (value) => setQuestionField({ trueAnswer: value })

  const setTrueNumber = (value) => setQuestionField({ trueNumber: value })

  // A player bowing out. They are switched off rather than deleted, so the
  // night carries on without them and nothing already scored has to be undone.
  async function leaveGame() {
    const done = await run(() => db.leaveGame(meId))
    if (done) forgetMe()
  }

  // The host removing somebody who has gone quiet - closed the laptop, lost
  // signal, wandered off - so the game stops waiting on an answer that is
  // never coming.
  const removePlayer = (playerId) => run(() => db.removePlayer(gameId, hostKey, playerId))

  // Deleting the whole game - host only, and only ever reached through a
  // control that asks twice. NOT routed through `run()`: that helper always
  // reloads afterwards, and reloading a game that was just deliberately
  // deleted would surface as "that game no longer exists" - a real error
  // message for something that went exactly as asked. Forgets both the local
  // player/game identity AND the saved host key, so a deleted game can never
  // be offered back as "resume hosting" on the start screen.
  async function deleteThisGame() {
    setBusy(true)
    const result = await db.deleteGame(gameId, hostKey)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return false
    }
    forgetSavedHostKey()
    forgetMe()
    return true
  }

  // -------------------------------------------------------------------------
  // Power-ups
  // -------------------------------------------------------------------------

  // Deals a fresh hand for ONE QUESTION of a Power-Up Quiz.
  //
  // It used to be one card per player for the whole round, spendable once.
  // That made the round a single decision - hold or spend - and the other two
  // questions were ordinary typed answers with a card nobody had left. Now
  // every question deals again, so every question is its own decision.
  //
  // Safe to call twice: the database clears that category's unused cards
  // before inserting, so a reload or a double-tap re-deals rather than
  // stacking up a hand. Cards already SPENT are left alone, because they are
  // the record of what happened on an earlier question.
  async function dealForQuestion(categoryId) {
    const tier = game.powerUpTier || 'basic'
    if (!categoryId) return

    const category = findCategory(game, categoryId)
    if (!category || category.type !== 'powerup') return

    const players = activePlayers(game)

    // What each player had LAST QUESTION, so nobody gets the same card twice
    // running while there is anything else in the deck.
    //
    // This used to read only the cards still sitting unplayed in people's
    // hands, which meant it did nothing at all for anybody who had actually
    // spent theirs - and a spent card is by far the more likely one to come
    // round again, because those are the players still making decisions. The
    // second audit watched a player spend Copycat and be dealt Copycat again
    // for the very next question, which is the exact thing this preference
    // exists to prevent. It now looks at the last card they held either way.
    const holding = {}
    ;(game.powerUps || []).forEach((card) => {
      if (card.categoryId !== categoryId || card.deck === 'loser') return
      holding[card.playerId] = card.key
    })

    const dealt = dealCards(POWER_UPS, tier, players.map((p) => p.id), holding)
    if (dealt.length === 0) return
    await db.dealPowerUps(gameId, hostKey, categoryId, 'power', dealt)
  }

  // Hands a card to whoever came last, to spend in the round coming up.
  // Everyone tied for last gets one, and it is drawn at random from the whole
  // deck rather than chosen.
  async function grantLoserSupport(finishedCategoryId, nextCategoryId) {
    const tier = game.powerUpTier || 'basic'
    if (!game.loserSupportEnabled || !nextCategoryId) return

    // A staked round (the Auction, the Wager Final) pays out win-or-lose an
    // entire stake, decided purely by whether points are above zero. Safety
    // Net and Nothing to Lose's "a wrong answer still scores 1 point" would
    // silently become "guaranteed win of everything you bet" there, and Free
    // Swing's doubling would do nothing at all. Keep them out of the draw
    // pool entirely for a round like that, rather than handing one out and
    // relying on the scoring code to neuter it after the fact.
    const nextCategory = findCategory(game, nextCategoryId)
    const nextRoundType = roundTypeFor({ type: nextCategory ? nextCategory.type : null })

    // A Power-Up Quiz already deals its own hand to every player at the start
    // of the round. Letting a held-over loser-support card ride along too
    // means two different power-up systems could land on the same question -
    // exactly the kind of clash the game was never designed to referee.
    // Skipped entirely for a round like that, rather than dealt and left to
    // clash: not a permanent loss, just this one round - a player who comes
    // last again before a non-Power-Up round gets a card as normal then.
    if (nextRoundType.hasPowerUps) return

    const losers = categoryLosers(game, finishedCategoryId)
    for (const loser of losers) {
      const key = dealOne(LOSER_SUPPORT, tier, { excludeStakedIncompatible: nextRoundType.hasWager })
      if (key) await db.grantPowerUp(gameId, hostKey, loser.id, nextCategoryId, 'loser', key)
    }
  }

  // One card per question, which is the rule as written. The hand goes
  // read-only after the first, and this is the second lock: two taps landing at
  // the same moment, or a stale screen, should not be able to spend two.
  const playPowerUp = (powerUpId, targetPlayerId) => {
    const alreadyPlayed = cardsPlayedOn(game, game.currentQuestionId).some(
      (card) => card.playerId === meId,
    )
    if (alreadyPlayed) return

    // Levelling always targets whoever is leading right now - nobody picks,
    // not the player and not the judge, so the app works it out here rather than
    // showing a picker. Once it is stored as an ordinary targetPlayerId, every
    // other screen (waiting-on counts, the sitting-out message, the cards
    // played list) can treat it exactly like a card with a chosen target.
    //
    // EXCEPT when the leader is the one holding the card. Levelling is meant
    // to knock the room's front-runner down a peg, not hand the leader a way
    // to sit themselves out on demand - if she is in first, the second-place
    // player takes the hit instead. A player would otherwise be able to bank
    // a Levelling card and detonate it on herself the moment she wanted a
    // free pass on a question she felt shaky on.
    const held = game.powerUps.find((card) => card.id === powerUpId)
    const definition = held ? findCard(held.key) : null
    const target =
      definition && definition.autoTargetsLeader ? autoLevellingTarget(game, meId) : targetPlayerId

    return run(() => db.playPowerUp(gameId, powerUpId, meId, game.currentQuestionId, target))
  }

  // What the guest of honour actually awarded on a payout card (Wildcard,
  // Bonus Question,
  // Vote of Confidence), once she has decided. Overwrites, never adds.
  const setPowerUpAward = (powerUpId, points) =>
    run(() => db.setPowerUpAward(gameId, hostKey, powerUpId, points))

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  // All four are the same shape: write my own answer row, and show it as sent
  // straight away. A player tapping "submit" on a phone should not be watching
  // the button to find out whether it worked.
  const saveMine = (fields) =>
    run(
      () =>
        db.saveAnswer(gameId, game.currentQuestionId, meId, db.answerFieldsToRow(fields)),
      { answers: withMyAnswer(game.answers, game.currentQuestionId, meId, fields) },
    )

  const submitAnswer = (payload) => saveMine({ ...payload, submitted: true })

  const setWager = (amount) => saveMine({ wager: amount })

  const submitBid = (amount) => saveMine({ bid: amount })

  const submitVote = (choiceId) =>
    run(() => db.saveVote(gameId, game.currentQuestionId, meId, choiceId), {
      votes: [
        ...(game.votes || []).filter(
          (v) => !(v.questionId === game.currentQuestionId && v.playerId === meId),
        ),
        { questionId: game.currentQuestionId, playerId: meId, choiceId },
      ],
    })

  // -------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------

  // The settings for the database are missing entirely, so nothing else in the
  // app can possibly work. Say so plainly and first. This message was written
  // for exactly this case and was never actually shown anywhere, which meant a
  // missing setting on the live site surfaced as a programmer's error message
  // on top of every other screen instead.
  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-board p-6 text-ivory">
        <div
          className="w-full max-w-md border-[3px] border-line bg-panel p-6 text-center"
          style={{ boxShadow: '9px 9px 0 0 var(--color-ink)' }}
        >
          <h1 className="mb-2 font-display text-[24px] leading-[1.15] text-ivory">
            Not Connected Yet
          </h1>
          <p className="text-[15px] text-ivory">{supabaseConfigError}</p>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingScreen message="Loading the game..." />

  // No game to show yet: either start one as host, or join one as a player.
  if (!gameId || !game) {
    return (
      <ErrorBoundary>
        <StartScreen
          error={error}
          busy={busy}
          onEnterRoom={handleEnterRoom}
          onJoin={handleJoin}
          onClearError={() => setError(null)}
        />
      </ErrorBoundary>
    )
  }


  return (
    <ErrorBoundary>
      <SubjectContext.Provider value={subjectFrom(game)}>
        <ConnectionBanner connection={connection} error={error} onDismiss={() => setError(null)} />
        <div>
          <GameRouter
  game={game}
  isHost={isHost}
  meIsInGame={meIsInGame}
  joining={joining}
  meId={meId}
  busy={busy}
  pendingCounts={pendingCounts}
  handleJoin={handleJoin}
  toggleCategory={toggleCategory}
  setQuestionCount={setQuestionCount}
  toggleLoserSupport={toggleLoserSupport}
  setPowerUpTier={setPowerUpTier}
  setSubject={setSubject}
  addOwnQuestion={addOwnQuestion}
  editQuestion={editQuestion}
  removeQuestion={removeQuestion}
  openLobby={openLobby}
  deleteThisGame={deleteThisGame}
  startGame={startGame}
  backToEditor={backToEditor}
  submitBid={submitBid}
  lockBids={lockBids}
  startTimer={startTimer}
  extendTimer={extendTimer}
  clearTimer={clearTimer}
  lockAnswers={lockAnswers}
  nextQuestion={nextQuestion}
  setTrueOrder={setTrueOrder}
  setTrueNumber={setTrueNumber}
  setTrueAnswer={setTrueAnswer}
  submitAnswer={submitAnswer}
  setWager={setWager}
  playPowerUp={playPowerUp}
  submitVote={submitVote}
  lockVotes={lockVotes}
  setPoints={setPoints}
  pickWinner={pickWinner}
  finishJudging={finishJudging}
  nextCategory={nextCategory}
  endGame={endGame}
  removePlayer={removePlayer}
  setPowerUpAward={setPowerUpAward}
  forgetMe={forgetMe}
/>

          {/* Players can bow out at any point. It asks twice, so nobody leaves
              by fumbling a tap.

              Pinned rather than stacked underneath: every in-game screen is a
              fixed frame that must not scroll, and a block in the flow below
              one made every player screen scroll by exactly its own height. */}
          {!isHost && meIsInGame && (
            <LeaveButton onLeave={leaveGame} onSwitchRoom={forgetMe} />
          )}
        </div>
      </SubjectContext.Provider>
    </ErrorBoundary>
  )
}
