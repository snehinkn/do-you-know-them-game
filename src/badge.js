// ---------------------------------------------------------------------------
// BADGES - the detective rank that moves up and down all night.
//
// Beat Cop -> Gumshoe -> Private Eye -> Ace -> Chief.
//
// WHY THIS IS NOT WHAT THE DESIGN SPECIFIED
//
// The redesign asked for "thresholds on running points". That cannot work in
// this app, and it is worth writing down why so nobody puts it back.
//
// The host chooses which of the eight rounds to play AND how many questions
// each one runs, up to the size of the bank. A short night might hand out
// thirty points in total; a long one, three hundred. Any fixed number - "Chief
// at 100" - is either unreachable or reached by everybody, depending on
// settings the host changed before the game began. A rank nobody can lose, or
// nobody can earn, is not a rank.
//
// So a badge is worked out from WHERE YOU STAND, not from how many points
// happen to exist. Specifically: your score as a share of the leader's score.
// That is scale-free - it reads the same on question three as on question
// thirty - and it gives the three properties the design actually depends on:
//
//   1. EVERYONE STARTS A BEAT COP. At kick-off nobody has anything, so nobody
//      has a share of anything, and the whole room is on the bottom rung. The
//      design's own gloss says so: "everyone starts here; not everyone leaves."
//
//   2. CHIEF IS WHOEVER IS WINNING. Not a milestone - the actual top of the
//      board. It can be shared, and it is taken off you the moment somebody
//      passes you, which is the only thing that makes it worth holding.
//
//   3. A BADGE IS STICKY. The bands are wide enough that an ordinary two-point
//      round does not move anybody. That matters because the rank card only
//      appears when a badge actually changes - if it fired every round it
//      would stop meaning anything, and it would add eight interruptions to
//      the night.
//
// Pure position ("1st is Chief, 2nd is Ace...") was tried on paper and thrown
// out: with five players and five badges it is just the leaderboard wearing a
// hat, every swap demotes somebody, and at kick-off - when everyone is tied on
// nothing - it would make the entire room Chief.
//
// WHEN IT IS WORKED OUT
//
// At the end of a round, never during one. The badge in the status bar has to
// hold still while a round is being played, or a player watches their rank
// flicker as answers are judged one at a time.
//
// NOTHING IS STORED. A badge is derived from scores that are themselves
// rebuilt from the answers every time (see `recomputeScores`), so there is no
// column for it, nothing to migrate, and nothing that can drift out of step
// with the points it is supposed to describe.
//
// NAMING: this file says "badge", never "rank". `rank` already means two other
// things here - a player's position in `rankedPlayers`, and the Rank Their
// Favourites round - and a third meaning would be a bug waiting to happen.
// ---------------------------------------------------------------------------

import { activePlayers, activeCategories, categoryLeaderboard, categoryPosition } from './gameHelpers.js'

// The five, bottom to top. Index IS the badge: 0 is the bottom rung, 4 the top,
// so "up one" is arithmetic rather than a lookup.
//
// The gloss is the italic line under the badge on the player's badge card and
// on the rank card. Beat Cop's is the design's own words; the rest are written
// to the same shape - one sentence, and the joke is on the badge, never on the
// player holding it.
export const BADGES = [
  {
    key: 'beat_cop',
    name: 'Beat Cop',
    gloss: 'The bottom rung. Everyone starts here; not everyone leaves.',
  },
  {
    key: 'gumshoe',
    name: 'Gumshoe',
    gloss: 'You have found the building. The door is a separate problem.',
  },
  {
    key: 'private_eye',
    name: 'Private Eye',
    gloss: 'Respectable. You could be trusted with a small case and a large hat.',
  },
  {
    key: 'ace',
    name: 'Ace',
    gloss: 'One good round from the top job, and everybody can see it.',
  },
  {
    key: 'chief',
    name: 'Chief',
    gloss: 'Top of the board. It is a loan, not a gift.',
  },
]

// The bottom rung, by name, for the handful of places that need it before a
// game has started.
export const STARTING_BADGE = 0

export function badgeAt(index) {
  return BADGES[clampIndex(index)]
}

function clampIndex(index) {
  if (!Number.isFinite(index)) return 0
  if (index < 0) return 0
  if (index > BADGES.length - 1) return BADGES.length - 1
  return Math.round(index)
}

// ---------------------------------------------------------------------------
// The bands.
//
// Written as integer cross-multiplications rather than `score / leaderScore`
// on purpose. Scores are whole numbers, so this is exact - no floating-point
// edge where a player sitting on precisely three quarters of the lead lands on
// the wrong side of the line depending on the arithmetic.
//
//   Chief        level with the leader
//   Ace          75% of the leader or better
//   Private Eye  50%
//   Gumshoe      25%
//   Beat Cop     everything below that, and everybody at kick-off
//
// HYSTERESIS: A BADGE IS HARDER TO LOSE THAN IT WAS TO EARN
//
// The bands alone are not enough, and the way that shows up is nasty. A player
// sitting exactly on a line - say on precisely three quarters of the lead -
// gets knocked off it the moment the LEADER scores, without doing anything
// wrong themselves. The lead grows, their share shrinks, and down they go. Next
// round they claw it back. A full-screen rank card every single round, for a
// player whose position never really changed.
//
// So a badge you already hold has a sixteenth of the lead of slack underneath
// it. You must clear the line to be promoted, but you must fall a clear step
// BELOW it to be demoted. That is what makes "held" the common case and a move
// worth stopping the game for.
//
// The one exception is Chief, which has no slack: it means level with the
// leader, and the moment somebody passes you it is theirs. Two people wearing
// the top badge when only one of them is winning would read as a bug, and
// losing the top job to somebody who just overtook you is the single best
// moment this whole system produces.
// ---------------------------------------------------------------------------

// The bottom of each band, in sixteenths of the leader's score. Chief is not
// here because it is not a fraction - it is "level with whoever is top".
const BAND_FLOOR_SIXTEENTHS = [0, 4, 8, 12]

// How far below your own band's floor you may sag before you actually drop,
// again in sixteenths of the lead.
const SLACK_SIXTEENTHS = 1

export function badgeIndexFor(score, leaderScore, held = null) {
  const points = Number.isFinite(score) ? Math.max(0, score) : 0
  const lead = Number.isFinite(leaderScore) ? Math.max(0, leaderScore) : 0

  // Nobody has scored yet - or, at the very start, nobody has played yet. The
  // whole room is on the bottom rung, which is exactly where the design wants
  // everyone to begin.
  if (lead <= 0) return 0

  const earned = bandFor(points, lead)
  if (held === null || held === undefined) return earned

  const holding = clampIndex(held)

  // Going up, or not moving at all. Nothing to soften.
  if (earned >= holding) return earned

  // Coming down off the top job. No slack: somebody has overtaken you.
  if (holding >= 4) return earned

  // Coming down anywhere else: hold on unless you have fallen a clear step
  // below your own band's floor.
  const floor = BAND_FLOOR_SIXTEENTHS[holding] - SLACK_SIXTEENTHS
  if (points * 16 >= lead * floor) return holding

  return earned
}

// The band a score earns outright, ignoring anything already held.
function bandFor(points, lead) {
  if (points >= lead) return 4
  if (points * 4 >= lead * 3) return 3
  if (points * 2 >= lead) return 2
  if (points * 4 >= lead) return 1
  return 0
}

// Badges for a set of {id, score} entries, worked out against whoever is top
// of that same set. Returns a plain object keyed by player id.
//
// `held` is an optional map of the badge each player is already wearing, which
// is what turns the slack above on. Leave it out and you get the raw bands.
export function badgesForScores(entries, held = null) {
  const list = entries || []
  const leaderScore = list.reduce((top, entry) => Math.max(top, entry.score || 0), 0)

  const byPlayer = {}
  list.forEach((entry) => {
    byPlayer[entry.id] = badgeIndexFor(
      entry.score || 0,
      leaderScore,
      held ? held[entry.id] : null,
    )
  })
  return byPlayer
}

// ---------------------------------------------------------------------------
// RUNNING SCORES, ROUND BY ROUND
//
// To say "up one" at the end of a round we need two numbers per player: where
// they stood after this round, and where they stood after the one before.
//
// Both are derived rather than remembered. `categoryLeaderboard` already works
// out what a player earned inside one round - the effective points, the staked
// rounds' win-or-lose-your-bet arithmetic, and the cards that simply hand
// points over. Adding those up round by round rebuilds the running total.
//
// The two things it has to do itself, because they live outside any one round:
// start from `baseScore`, and floor the result at zero the way `recomputeScores`
// does. A player who bet everything and lost is on nothing, not in the hole.
// ---------------------------------------------------------------------------
export function scoresAfterRound(game, categoryIndex) {
  const players = activePlayers(game)
  const categories = activeCategories(game)
  const upTo = Math.min(categoryIndex, categories.length - 1)

  const totals = players.map((player) => ({
    id: player.id,
    name: player.displayName,
    score: player.baseScore || 0,
  }))

  for (let i = 0; i <= upTo; i++) {
    const board = categoryLeaderboard(game, categories[i].id)
    board.forEach((entry) => {
      const total = totals.find((t) => t.id === entry.id)
      if (total) total.score += entry.score
    })
  }

  totals.forEach((total) => {
    if (total.score < 0) total.score = 0
  })

  return totals
}

// ---------------------------------------------------------------------------
// Because a badge is sticky, it is not a function of one round's scores alone -
// it depends on what you were already wearing, which depends on the round
// before that. So it is worked out forwards from kick-off, every time.
//
// Cheap enough: eight rounds and six players is nothing, and deriving it fresh
// means it can never drift out of step with scores that are themselves rebuilt
// from the answers on every load.
//
// Returns the badge map at the end of each round, indexed by round.
// ---------------------------------------------------------------------------
function badgeTimeline(game, upToIndex) {
  const players = activePlayers(game)
  const categories = activeCategories(game)
  const last = Math.min(upToIndex, categories.length - 1)

  const running = players.map((player) => ({
    id: player.id,
    name: player.displayName,
    score: player.baseScore || 0,
  }))

  // Everybody starts on the bottom rung.
  let held = {}
  players.forEach((player) => {
    held[player.id] = 0
  })

  const timeline = []

  for (let i = 0; i <= last; i++) {
    const board = categoryLeaderboard(game, categories[i].id)
    board.forEach((entry) => {
      const total = running.find((t) => t.id === entry.id)
      if (total) total.score += entry.score
    })
    running.forEach((total) => {
      if (total.score < 0) total.score = 0
    })

    held = badgesForScores(running, held)
    timeline.push({ ...held })
  }

  return timeline
}

// Every player's badge at the end of a given round. `categoryIndex` is the
// position of the round in the running order, zero-based.
//
// Before the first round has finished there is nothing to work out and
// everybody is a Beat Cop.
export function badgesAfterRound(game, categoryIndex) {
  const starting = {}
  activePlayers(game).forEach((player) => {
    starting[player.id] = 0
  })

  if (categoryIndex < 0) return starting

  const timeline = badgeTimeline(game, categoryIndex)
  return timeline.length > 0 ? timeline[timeline.length - 1] : starting
}

// ---------------------------------------------------------------------------
// THE MOVE
//
// What changed for one player across one round, in the words the ledger and
// the rank card both print.
//
// `suffix` is what goes after the badge name on a round-results row -
// "PRIVATE EYE · UP ONE" - which the design asks for as typed words rather
// than an arrow.
// ---------------------------------------------------------------------------
const STEP_WORDS = ['', 'ONE', 'TWO', 'THREE', 'FOUR']

export function badgeMove(before, after) {
  const from = clampIndex(before)
  const to = clampIndex(after)
  const steps = Math.abs(to - from)

  if (steps === 0) {
    return { direction: 'held', steps: 0, from, to, suffix: 'HELD', badge: badgeAt(to) }
  }

  const direction = to > from ? 'up' : 'down'
  const word = STEP_WORDS[steps] || String(steps)

  return {
    direction,
    steps,
    from,
    to,
    suffix: `${direction === 'up' ? 'UP' : 'DOWN'} ${word}`,
    badge: badgeAt(to),
  }
}

// ---------------------------------------------------------------------------
// THE STATUS BAR'S OWN BADGE
//
// What a player's badge reads RIGHT NOW, for the chip that sits in the top of
// every phone screen all night. Deliberately the badge as of the end of the
// last COMPLETED round, not a live recompute against the current one - the
// design is explicit that the status bar has to hold still while a round is
// being played (see the note at the top of this file), and a card mid-judging
// has partially-awarded points that make no honest badge anyway.
// ---------------------------------------------------------------------------
export function currentBadgeFor(game, playerId) {
  const position = categoryPosition(game)
  // `position.number` is the CURRENT round, one-based. The last round that has
  // actually finished is one before that, zero-based - so subtract two. Before
  // any round has finished this goes negative, and `badgesAfterRound` already
  // treats a negative index as "nothing has happened yet".
  const moves = badgesAfterRound(game, position.number - 2)
  return badgeAt(moves[playerId] ?? 0)
}

// Every player's move across one round, keyed by player id. This is what the
// round-results ledger reads, and what decides whether a rank card is shown at
// all - the design only earns one when a badge actually moves, which is the
// whole reason a held badge is the common case.
export function badgeMovesForRound(game, categoryIndex) {
  const starting = {}
  activePlayers(game).forEach((player) => {
    starting[player.id] = 0
  })

  // One walk forwards gives both ends of the move, so the sticky badge is
  // carried through exactly once rather than being rebuilt twice.
  const timeline = badgeTimeline(game, categoryIndex)
  const after = timeline[timeline.length - 1] || starting
  const before = timeline.length > 1 ? timeline[timeline.length - 2] : starting

  const moves = {}
  activePlayers(game).forEach((player) => {
    moves[player.id] = badgeMove(before[player.id] ?? 0, after[player.id] ?? 0)
  })
  return moves
}

// Does this player get a full-screen rank card after this round? Only when the
// badge actually moved. A held badge never earns one - that is what keeps the
// card worth stopping the game for.
export function earnsRankCard(move) {
  return Boolean(move) && move.direction !== 'held'
}
