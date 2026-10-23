import { supabase } from './supabaseClient.js'
import {
  CATEGORY_SETUP,
  defaultCountFor,
  drawQuestions,
  maxQuestionsFor,
  pointsFor,
} from './questionBank.js'
import { subjectFrom, fillQuestion } from './subject.js'

// ---------------------------------------------------------------------------
// EVERY conversation with the database happens in this file.
//
// SINCE 5 SEPTEMBER, IT ALL GOES THROUGH GUARDED FUNCTIONS, NOT RAW TABLES.
//
// An outside audit found that the database's own rules let anyone read or
// write anything, for any game, with no key of any kind - verified live, not
// theoretical. `supabase-rls-hardening.sql` closes that on the database side:
// every table's direct insert/update/delete is switched off, and the two
// secret things (the host's key, the live answer key) live in tables the
// public key cannot read at all. In their place, a small set of Postgres
// functions - each one checking a host key or a player id before it does
// anything - do the actual work. This file is the only place that calls them.
//
// WHAT DID NOT CHANGE: every function below still takes the same kind of
// plain JavaScript values it always did, and still returns
// `{ data, error }`. The screens and `App.jsx` mostly do not need to know any
// of this happened - they just now have to pass along a host key or player id
// they already had sitting in scope.
//
// The database uses snake_case names (points_awarded) because that is the
// Postgres convention. The app uses camelCase (pointsAwarded) because that is
// the JavaScript convention. The mappers at the bottom translate between them,
// so neither side has to think about the other.
// ---------------------------------------------------------------------------

// Room codes get read aloud on a Discord call, so no O/0 or I/1 confusion.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeRoomCode() {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  }
  return code
}

// Wraps a database call so callers get { data, error } with a readable message
// instead of an exception. Nothing in this app should ever crash on a failed
// network call - it should say what went wrong, on screen.
// A dropped connection is by far the most likely failure on the night, and the
// browser reports it as "Failed to fetch", which means nothing to anyone. Say
// what it actually is, and what to do, before the technical detail.
function readableProblem(label, raw) {
  const detail = String(raw || '')
  const looksLikeNetwork =
    /failed to fetch|networkerror|network error|load failed|fetch failed|timeout|aborted/i.test(
      detail,
    )

  if (looksLikeNetwork) {
    return (
      label +
      " didn't go through. This is almost always the internet connection. " +
      'Wait a moment and try again, or tap Reload.'
    )
  }
  // A guarded function's own `raise exception` message (e.g. "Somebody
  // already joined with that name...") arrives here as `raw` and is shown
  // as-is - it was already written to be read by a person. Only Postgres's
  // own raw error text gets the generic wrapping below.
  return label + " didn't go through. Try again, or tap Reload. (" + detail + ')'
}

async function attempt(label, run) {
  try {
    const { data, error } = await run()
    if (error) {
      return { data: null, error: readableProblem(label, error.message) }
    }
    return { data, error: null }
  } catch (problem) {
    return { data: null, error: readableProblem(label, problem.message || problem) }
  }
}

// A guarded function's own message (from `raise exception` in the SQL) is
// already written in plain English for a person to read - unlike a raw
// network failure, it should reach the screen untouched rather than wrapped
// in "X didn't go through". Used for the handful of calls where the SQL
// function's error IS the whole answer (a taken name, a finished game, a bad
// host link) rather than a plumbing failure.
async function attemptPlain(run) {
  try {
    const { data, error } = await run()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (problem) {
    return { data: null, error: String(problem.message || problem) }
  }
}

// ---------------------------------------------------------------------------
// CREATING A GAME
// ---------------------------------------------------------------------------

// One question, ready to be sent to `rpc_create_game`. The bank holds a
// question's wording and nothing else; everything here that says WHERE it
// sits is added at the moment it is dealt into a game.
function questionPayload(categoryIndex, question, orderIndex) {
  return {
    category_index: categoryIndex,
    type: question.type,
    order_index: orderIndex,
    text: question.text,
    points: question.points,
    items: question.items ?? null,
    topic: question.topic ?? null,
  }
}

export async function createGame() {
  const roomCode = makeRoomCode()

  const categoryRows = CATEGORY_SETUP.map((category, index) => ({
    type: category.type,
    order_index: index,
    included: category.included,
  }))

  // Each round draws its own opening hand at random. The host can change any
  // round's count on the setup screen afterwards - see
  // `setCategoryQuestionCount` - so these are a starting point, not a decision.
  const questionRows = []
  CATEGORY_SETUP.forEach((category, categoryIndex) => {
    const drawn = drawQuestions(category.type, defaultCountFor(category.type))
    drawn.forEach((question, index) => {
      questionRows.push(questionPayload(categoryIndex, question, index))
    })
  })

  const result = await attempt('Creating the game', () =>
    supabase.rpc('rpc_create_game', {
      p_room_code: roomCode,
      p_category_rows: categoryRows,
      p_question_rows: questionRows,
    }),
  )
  if (result.error) return result

  // The one time the host key is ever handed to a browser - see
  // `StartScreen.handleCreate`, which reads `data.host_key` off this exact
  // shape and turns it into the `?host=` link. Everything after this reads
  // the key back from that link, never from a fresh fetch.
  return { data: { ...gameFromRow(result.data.game), host_key: result.data.host_key }, error: null }
}

// ---------------------------------------------------------------------------
// LOADING A GAME
// ---------------------------------------------------------------------------

export async function findGameByRoomCode(roomCode) {
  return attempt('Finding the game', () =>
    supabase.rpc('rpc_find_game_by_room_code', { p_room_code: roomCode.trim().toUpperCase() }),
  )
}

export async function findGameByHostKey(hostKey) {
  return attempt('Finding your game', () =>
    supabase.rpc('rpc_find_game_by_host_key', { p_host_key: hostKey }),
  )
}

// Pulls the whole game in one go and shapes it the way the screens expect.
//
// `hostKey` decides whether the answer key comes with it - it is read from
// the `?host=` link (see `useGame.js`), and it is now checked BY THE DATABASE
// itself, not merely left unasked-for by this file's own queries. A player's
// browser passes `null` here and gets exactly what a player is entitled to,
// however the request was actually made.
export async function loadFullGame(gameId, { hostKey = null } = {}) {
  const result = await attempt('Loading the game', () =>
    supabase.rpc('rpc_load_full_game', { p_game_id: gameId, p_host_key: hostKey }),
  )
  if (result.error) return result

  const row = result.data
  if (!row) {
    // Only a call that succeeded and found no game counts as missing - see
    // the note on this in `useGame.js`.
    return { data: null, missing: true, error: 'That game no longer exists.' }
  }

  // THE ONE PLACE `{name}` BECOMES A NAME.
  //
  // Questions are stored with their tokens intact and filled in here, on the
  // way out - so every screen downstream reads `question.text` and never
  // learns a token existed. Filling here rather than when the questions were
  // dealt is what makes renaming work: the host can change the name on the
  // setup screen at any point, and every question already dealt simply reads
  // differently on the next load.
  const subject = subjectFrom(gameFromRow(row.game))

  return {
    data: {
      ...gameFromRow(row.game),
      categories: row.categories.map(categoryFromRow),
      questions: row.questions.map((q) => fillQuestion(questionFromRow(q), subject)),
      players: row.players.map(playerFromRow),
      answers: row.answers.map(answerFromRow),
      votes: row.votes.map(voteFromRow),
      powerUps: row.power_ups.map(powerUpFromRow),
    },
    error: null,
  }
}

// ---------------------------------------------------------------------------
// WRITING - PUBLIC (no key required, same trust level as always: a room code
// or a game id already in hand is what "being allowed in" has always meant)
// ---------------------------------------------------------------------------

export async function joinGame(gameId, displayName) {
  return attemptPlain(() =>
    supabase.rpc('rpc_join_game', { p_game_id: gameId, p_display_name: displayName }),
  )
}

// A player bowing out. Only ever called with your OWN id (see
// `App.leaveGame`), so no extra proof is asked for - the same standing this
// app has always given a player who simply knows their own id.
export async function leaveGame(playerId) {
  return attempt('Leaving the game', () => supabase.rpc('rpc_leave_game', { p_player_id: playerId }))
}

// ---------------------------------------------------------------------------
// WRITING - PLAYER-OWNED (the given player id must actually belong to the
// given game - checked by the database now, which was not true before at
// all)
// ---------------------------------------------------------------------------

export async function saveAnswer(gameId, questionId, playerId, fields) {
  return attempt('Submitting your answer', () =>
    supabase.rpc('rpc_save_answer', {
      p_game_id: gameId,
      p_question_id: questionId,
      p_player_id: playerId,
      p_fields: fields,
    }),
  )
}

export async function saveVote(gameId, questionId, playerId, choiceId) {
  return attempt('Saving your guess', () =>
    supabase.rpc('rpc_save_vote', {
      p_game_id: gameId,
      p_question_id: questionId,
      p_player_id: playerId,
      p_choice_id: choiceId,
    }),
  )
}

export async function playPowerUp(gameId, powerUpId, playerId, questionId, targetPlayerId) {
  return attempt('Playing your power-up', () =>
    supabase.rpc('rpc_play_power_up', {
      p_game_id: gameId,
      p_power_up_id: powerUpId,
      p_player_id: playerId,
      p_question_id: questionId,
      p_target_player_id: targetPlayerId || null,
    }),
  )
}

// ---------------------------------------------------------------------------
// WRITING - HOST-ONLY (every one of these now checks the real host key
// against the game before doing anything)
// ---------------------------------------------------------------------------

export async function updateGame(gameId, hostKey, fields) {
  return attempt('Saving the game', () =>
    supabase.rpc('rpc_update_game', { p_game_id: gameId, p_host_key: hostKey, p_fields: fields }),
  )
}

export async function deleteGame(gameId, hostKey) {
  return attempt('Deleting the game', () =>
    supabase.rpc('rpc_delete_game', { p_game_id: gameId, p_host_key: hostKey }),
  )
}

export async function removePlayer(gameId, hostKey, playerId) {
  return attempt('Removing that player', () =>
    supabase.rpc('rpc_remove_player', { p_game_id: gameId, p_host_key: hostKey, p_player_id: playerId }),
  )
}

export async function setCategoryIncluded(gameId, hostKey, categoryId, included) {
  return attempt('Changing the rounds', () =>
    supabase.rpc('rpc_set_category_included', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_category_id: categoryId,
      p_included: included,
    }),
  )
}

// How many questions a round runs, chosen by the host on the setup screen.
//
// Drawing still happens here, in JavaScript, because the bank's actual text
// lives in the app's own code (`src/bank/`), not in the database. What goes
// to the database is a batch of freshly-drawn CANDIDATES; the guarded
// function on the other end decides, inside one transaction, how many of
// them are still actually needed and inserts only that many. That is what
// keeps two overlapping taps (or two people editing the same round from two
// tabs) from both inserting a full batch on top of an already-correct count -
// the exact race `HANDOFF-21.md` §4 found and patched client-side; this
// closes it server-side too, which is the version that actually holds under
// two different browsers.
export async function setCategoryQuestionCount(gameId, hostKey, category, desired) {
  const max = maxQuestionsFor(category.type)
  const target = Math.max(1, Math.min(max, desired))

  const drawPool = drawQuestions(category.type, target).map((question) => ({
    type: question.type,
    text: question.text,
    points: question.points,
    items: question.items ?? null,
    topic: question.topic ?? null,
  }))

  return attempt('Changing the questions', () =>
    supabase.rpc('rpc_set_category_question_count', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_category_id: category.id,
      p_target: target,
      p_draw_pool: drawPool,
    }),
  )
}

// A host writing their own question, rather than drawing one from the bank.
export async function addOwnQuestion(gameId, hostKey, category, input) {
  return attempt('Adding your question', () =>
    supabase.rpc('rpc_add_own_question', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_category_id: category.id,
      p_input: {
        text: input.text,
        points: pointsFor(category.type),
        items: input.items ?? null,
        topic: input.topic ?? null,
      },
    }),
  )
}

export async function removeQuestion(gameId, hostKey, questionId) {
  return attempt('Removing that question', () =>
    supabase.rpc('rpc_remove_question', { p_game_id: gameId, p_host_key: hostKey, p_question_id: questionId }),
  )
}

export async function setQuestionFields(gameId, hostKey, questionId, fields) {
  return attempt('Saving that', () =>
    supabase.rpc('rpc_set_question_fields', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_question_id: questionId,
      p_fields: fields,
    }),
  )
}

export async function createEmptyAnswers(gameId, hostKey, questionId, playerIds) {
  if (playerIds.length === 0) return { data: [], error: null }
  return attempt('Making room on the scoresheet', () =>
    supabase.rpc('rpc_create_empty_answers', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_question_id: questionId,
      p_player_ids: playerIds,
    }),
  )
}

export async function setAnswerPoints(gameId, hostKey, answerId, points) {
  return attempt('Saving the score', () =>
    supabase.rpc('rpc_set_answer_points', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_answer_id: answerId,
      p_points: points,
    }),
  )
}

// Used when a whole round is scored at once (closest guess, ranking, fibbage).
export async function setManyAnswerPoints(gameId, hostKey, pointsByAnswerId) {
  if (Object.keys(pointsByAnswerId).length === 0) return { data: null, error: null }
  return attempt('Saving the scores', () =>
    supabase.rpc('rpc_set_many_answer_points', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_points: pointsByAnswerId,
    }),
  )
}

// ---------------------------------------------------------------------------
// POWER-UPS - dealing is a host action; playing one is a player action (see
// `playPowerUp` above).
// ---------------------------------------------------------------------------

export async function dealPowerUps(gameId, hostKey, categoryId, deck, dealt) {
  return attempt('Dealing power-ups', () =>
    supabase.rpc('rpc_deal_power_ups', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_category_id: categoryId,
      p_deck: deck,
      p_dealt: dealt.map((card) => ({ playerId: card.playerId, key: card.key })),
    }),
  )
}

export async function grantPowerUp(gameId, hostKey, playerId, categoryId, deck, cardKey) {
  return attempt('Handing out a power-up', () =>
    supabase.rpc('rpc_grant_power_up', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_player_id: playerId,
      p_category_id: categoryId,
      p_deck: deck,
      p_card_key: cardKey,
    }),
  )
}

export async function setPowerUpAward(gameId, hostKey, powerUpId, points) {
  return attempt('Saving the payout', () =>
    supabase.rpc('rpc_set_power_up_award', {
      p_game_id: gameId,
      p_host_key: hostKey,
      p_power_up_id: powerUpId,
      p_points: points,
    }),
  )
}

// ---------------------------------------------------------------------------
// REALTIME
//
// This is what makes everyone's screen change at the same moment. Every
// client listens for any change to its own game and simply reloads the
// whole thing. Unaffected by the security change above: reading (SELECT) is
// still open on these seven tables, which is what realtime needs to keep
// working, and the two secret tables are never part of it at all.
// ---------------------------------------------------------------------------
export function subscribeToGame(gameId, onChange, onStatusChange) {
  const channel = supabase.channel('game-' + gameId)

  const tables = [
    'games',
    'categories',
    'questions',
    'players',
    'answers',
    'votes',
    'power_ups',
  ]
  tables.forEach((table) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        // The games table keys on `id`; everything else on `game_id`.
        filter: (table === 'games' ? 'id=eq.' : 'game_id=eq.') + gameId,
      },
      onChange,
    )
  })

  channel.subscribe((status) => {
    if (onStatusChange) onStatusChange(status)
  })

  return () => {
    supabase.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// MAPPERS - database row shape <-> app shape
// ---------------------------------------------------------------------------

function gameFromRow(row) {
  return {
    id: row.id,
    roomCode: row.room_code,
    status: row.status,
    currentQuestionId: row.current_question_id,
    winnerAnswerId: row.winner_answer_id,
    loserSupportEnabled: row.loser_support_enabled,

    // Who the game is about. Read straight through; subject.js is what turns
    // it into words, and supplies the fallback.
    subjectName: row.subject_name,
    subjectPronouns: row.subject_pronouns,

    // The countdown running right now, or null when no timer is live. An ISO
    // timestamp rather than a duration, so every phone counts down from the
    // same instant instead of from whenever its own screen happened to render.
    timerEndsAt: row.timer_ends_at,
    // New games arrive from the database on a tier called "off", which was
    // removed when the "there is no off" decision was taken. Left as-is it
    // matched none of the three buttons, so the setup screen showed no level
    // chosen at all while quietly playing Basic. Anything unrecognised is Basic.
    powerUpTier: ['basic', 'advanced', 'mayhem'].includes(row.power_up_tier)
      ? row.power_up_tier
      : 'basic',
  }
}

function categoryFromRow(row) {
  return {
    id: row.id,
    type: row.type,
    orderIndex: row.order_index,
    included: row.included,
  }
}

function questionFromRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    type: row.type,
    orderIndex: row.order_index,
    text: row.text,
    points: row.points,
    trueNumber: row.true_number,
    trueAnswer: row.true_answer,
    trueOrder: row.true_order,
    items: row.items,
    topic: row.topic,
  }
}

function playerFromRow(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    score: row.base_score, // recalculated from answers on the client
    baseScore: row.base_score,
    // Older projects may not have this column yet; treat missing as playing.
    active: row.active !== false,
  }
}

// Exported because `App.lockVotes` creates answer rows and then scores against
// them in the same action, so it needs the new rows in the app's own shape
// without waiting for a full reload first.
export function answerFromRow(row) {
  return {
    id: row.id,
    questionId: row.question_id,
    playerId: row.player_id,
    text: row.text,
    number: row.number,
    order: row.answer_order,
    wager: row.wager,
    bid: row.bid,
    submitted: row.submitted,
    pointsAwarded: row.points_awarded,
  }
}

function powerUpFromRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    categoryId: row.category_id,
    deck: row.deck,
    key: row.card_key,
    questionId: row.played_on_question_id,
    targetPlayerId: row.target_player_id,
    used: row.used,
    awardPoints: row.award_points,
    playedAt: row.played_at,
  }
}

function voteFromRow(row) {
  return {
    playerId: row.player_id,
    questionId: row.question_id,
    choiceId: row.choice_id,
  }
}

// The app's `order` field is called `answer_order` in the database, because
// "order" is a reserved word in SQL.
export function answerFieldsToRow(fields) {
  const row = {}
  if ('text' in fields) row.text = fields.text
  if ('number' in fields) row.number = fields.number
  if ('order' in fields) row.answer_order = fields.order
  if ('wager' in fields) row.wager = fields.wager
  if ('bid' in fields) row.bid = fields.bid
  if ('submitted' in fields) row.submitted = fields.submitted
  if ('pointsAwarded' in fields) row.points_awarded = fields.pointsAwarded
  return row
}

export function questionFieldsToRow(fields) {
  const row = {}
  if ('trueNumber' in fields) row.true_number = fields.trueNumber
  if ('trueOrder' in fields) row.true_order = fields.trueOrder
  if ('trueAnswer' in fields) row.true_answer = fields.trueAnswer
  if ('text' in fields) row.text = fields.text
  if ('points' in fields) row.points = fields.points
  if ('items' in fields) row.items = fields.items
  if ('topic' in fields) row.topic = fields.topic
  return row
}

export function gameFieldsToRow(fields) {
  const row = {}
  if ('status' in fields) row.status = fields.status
  if ('currentQuestionId' in fields) row.current_question_id = fields.currentQuestionId
  if ('winnerAnswerId' in fields) row.winner_answer_id = fields.winnerAnswerId
  if ('loserSupportEnabled' in fields) row.loser_support_enabled = fields.loserSupportEnabled
  if ('powerUpTier' in fields) row.power_up_tier = fields.powerUpTier
  if ('subjectName' in fields) row.subject_name = fields.subjectName
  if ('subjectPronouns' in fields) row.subject_pronouns = fields.subjectPronouns
  if ('timerEndsAt' in fields) row.timer_ends_at = fields.timerEndsAt
  return row
}

// ---------------------------------------------------------------------------
// TIMERS
//
// A timer is nothing but `games.timer_ends_at` - a future timestamp, or null
// for no timer. Starting one and extending one are the same write; the
// difference is only in what the caller computes as the new end time. Every
// client renders its own countdown from this same timestamp (see
// `useCountdown.js`), which is what keeps phones in the same room from
// drifting apart on how much time is left.
// ---------------------------------------------------------------------------

export async function startTimer(gameId, hostKey, seconds) {
  const endsAt = new Date(Date.now() + seconds * 1000).toISOString()
  return updateGame(gameId, hostKey, { timer_ends_at: endsAt })
}

// Adds seconds to whatever the timer currently reads - or starts a fresh one
// from now, if for some reason this is called with no timer running. Reading
// `currentEndsAt` back from the caller rather than re-deriving it here keeps
// this a plain, dumb write with no read of its own.
export async function extendTimer(gameId, hostKey, currentEndsAt, seconds) {
  const base = currentEndsAt ? new Date(currentEndsAt).getTime() : Date.now()
  const endsAt = new Date(Math.max(base, Date.now()) + seconds * 1000).toISOString()
  return updateGame(gameId, hostKey, { timer_ends_at: endsAt })
}

export async function clearTimer(gameId, hostKey) {
  return updateGame(gameId, hostKey, { timer_ends_at: null })
}
