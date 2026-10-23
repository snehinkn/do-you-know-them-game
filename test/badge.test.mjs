// The detective badge - Beat Cop through Chief.
//
// This is the one piece of NEW game logic the pulp-noir redesign brings, so it
// gets pinned hard. The failure modes are not crashes; they are a room full of
// people all wearing the same badge all night, or a full-screen rank card
// firing after every single round until nobody looks at it.
//
// The properties that actually matter are the first four tests. Everything
// after that is arithmetic.
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BADGES,
  badgeAt,
  badgeIndexFor,
  badgesForScores,
  badgeMove,
  badgeMovesForRound,
  badgesAfterRound,
  scoresAfterRound,
  earnsRankCard,
} from '../src/badge.js'

// --- The four properties the design rests on -------------------------------

test('everyone starts a Beat Cop, because nobody has scored yet', () => {
  const start = badgesForScores([
    { id: 'ana', score: 0 },
    { id: 'bo', score: 0 },
    { id: 'cal', score: 0 },
  ])
  assert.deepEqual(start, { ana: 0, bo: 0, cal: 0 })
  assert.equal(badgeAt(0).name, 'Beat Cop')
})

test('Chief is whoever is actually winning, and can be shared', () => {
  const badges = badgesForScores([
    { id: 'ana', score: 40 },
    { id: 'bo', score: 40 },
    { id: 'cal', score: 8 },
  ])
  assert.equal(badges.ana, 4)
  assert.equal(badges.bo, 4)
  assert.equal(badgeAt(badges.ana).name, 'Chief')
  // Cal is on a fifth of the lead, so he is still walking a beat.
  assert.equal(badges.cal, 0)
})

// The whole reason the badge is a share of the lead rather than a fixed
// milestone: the host decides how long the night is, so the same standing has
// to read the same whether thirty points exist or three hundred.
test('the same standing gives the same badge at any game length', () => {
  const short = badgesForScores([
    { id: 'ana', score: 20 },
    { id: 'bo', score: 15 },
    { id: 'cal', score: 4 },
  ])
  const long = badgesForScores([
    { id: 'ana', score: 200 },
    { id: 'bo', score: 150 },
    { id: 'cal', score: 40 },
  ])
  assert.deepEqual(short, long)
})

// If a badge moved every round the rank card would fire eight times a night
// and stop being worth stopping the game for.
//
// These are deliberately awkward numbers: Bo is sitting EXACTLY on the Ace
// line at 15 of 20. Without the slack in `badgeIndexFor` the leader scoring
// two points would demote him for doing nothing wrong, and he would bounce
// back up next round. That bug is what this test exists to hold shut.
test('an ordinary round does not move anybody', () => {
  const before = badgesForScores([
    { id: 'ana', score: 20 },
    { id: 'bo', score: 15 },
    { id: 'cal', score: 9 },
  ])
  assert.deepEqual(before, { ana: 4, bo: 3, cal: 1 })

  // One more question, judged the way most questions are judged.
  const after = badgesForScores(
    [
      { id: 'ana', score: 22 },
      { id: 'bo', score: 16 },
      { id: 'cal', score: 9 },
    ],
    before,
  )
  assert.deepEqual(before, after)
  Object.keys(before).forEach((id) => {
    assert.equal(badgeMove(before[id], after[id]).direction, 'held')
    assert.equal(earnsRankCard(badgeMove(before[id], after[id])), false)
  })
})

// --- The slack --------------------------------------------------------------

test('a badge you hold survives sagging just below its own line', () => {
  // The Ace line is three quarters of 100. Holding Ace, 74 keeps it.
  assert.equal(badgeIndexFor(74, 100, 3), 3)
  // Without holding it, 74 does not earn it.
  assert.equal(badgeIndexFor(74, 100), 2)
})

test('but a real slide still demotes you', () => {
  // A sixteenth of 100 is 6.25, so the floor under a held Ace is 68.75.
  assert.equal(badgeIndexFor(69, 100, 3), 3)
  assert.equal(badgeIndexFor(68, 100, 3), 2)
  // And a collapse drops you more than one rung at a time.
  assert.equal(badgeIndexFor(20, 100, 3), 0)
})

test('the slack never helps you climb - you must clear the line to be promoted', () => {
  assert.equal(badgeIndexFor(74, 100, 2), 2)
  assert.equal(badgeIndexFor(75, 100, 2), 3)
})

// Chief is the one badge with no slack. It means "level with the leader", and
// two people wearing it while only one of them is winning would read as broken.
test('the top job has no slack - being overtaken takes it off you at once', () => {
  assert.equal(badgeIndexFor(99, 100, 4), 3)
  assert.equal(badgeIndexFor(100, 100, 4), 4)
})

// --- The bands -------------------------------------------------------------

test('the bands sit exactly on the quarters of the lead', () => {
  // Lead of 100 makes the boundaries readable.
  assert.equal(badgeIndexFor(100, 100), 4) // Chief - level with the leader
  assert.equal(badgeIndexFor(99, 100), 3) // Ace
  assert.equal(badgeIndexFor(75, 100), 3) // Ace, exactly on the line
  assert.equal(badgeIndexFor(74, 100), 2) // Private Eye
  assert.equal(badgeIndexFor(50, 100), 2) // Private Eye, exactly on the line
  assert.equal(badgeIndexFor(49, 100), 1) // Gumshoe
  assert.equal(badgeIndexFor(25, 100), 1) // Gumshoe, exactly on the line
  assert.equal(badgeIndexFor(24, 100), 0) // Beat Cop
  assert.equal(badgeIndexFor(0, 100), 0)
})

// Written as integer cross-multiplication precisely so this cannot drift.
test('a boundary that would be ugly in floating point still lands cleanly', () => {
  // 3/4 of 7 is 5.25. A player on 6 is above it, a player on 5 is below.
  assert.equal(badgeIndexFor(6, 7), 3)
  assert.equal(badgeIndexFor(5, 7), 2)
  // 1/4 of 3 is 0.75. One point clears it.
  assert.equal(badgeIndexFor(1, 3), 1)
})

test('nothing on the board leaves everybody on the bottom rung', () => {
  assert.equal(badgeIndexFor(0, 0), 0)
  assert.deepEqual(badgesForScores([]), {})
})

test('a negative or missing score is treated as nothing, not as a crash', () => {
  assert.equal(badgeIndexFor(-5, 20), 0)
  assert.equal(badgeIndexFor(undefined, 20), 0)
  assert.equal(badgeIndexFor(10, undefined), 0)
  assert.equal(badgeIndexFor(NaN, 20), 0)
})

test('an out-of-range badge index is clamped rather than returning nothing', () => {
  assert.equal(badgeAt(-3).key, 'beat_cop')
  assert.equal(badgeAt(99).key, 'chief')
  assert.equal(badgeAt(undefined).key, 'beat_cop')
})

test('there are five badges and every one has a name and a gloss', () => {
  assert.equal(BADGES.length, 5)
  BADGES.forEach((badge) => {
    assert.ok(badge.name.length > 0)
    assert.ok(badge.gloss.length > 0, `${badge.name} has no gloss`)
  })
  assert.deepEqual(
    BADGES.map((b) => b.name),
    ['Beat Cop', 'Gumshoe', 'Private Eye', 'Ace', 'Chief'],
  )
})

// --- The move, in the words the ledger prints ------------------------------

test('a move reads as typed words, not an arrow', () => {
  assert.equal(badgeMove(1, 2).suffix, 'UP ONE')
  assert.equal(badgeMove(3, 1).suffix, 'DOWN TWO')
  assert.equal(badgeMove(2, 2).suffix, 'HELD')
  assert.equal(badgeMove(0, 4).suffix, 'UP FOUR')
})

test('a move carries the badge it landed on, so the card can name it', () => {
  const move = badgeMove(1, 2)
  assert.equal(move.direction, 'up')
  assert.equal(move.steps, 1)
  assert.equal(move.badge.name, 'Private Eye')
  assert.equal(earnsRankCard(move), true)
})

test('only a real move earns a rank card', () => {
  assert.equal(earnsRankCard(badgeMove(2, 3)), true)
  assert.equal(earnsRankCard(badgeMove(2, 1)), true)
  assert.equal(earnsRankCard(badgeMove(2, 2)), false)
  assert.equal(earnsRankCard(null), false)
})

// --- Running totals, round by round ----------------------------------------

const threeRoundGame = () => ({
  categories: [
    { id: 'c1', type: 'typed', orderIndex: 0, included: true },
    { id: 'c2', type: 'typed', orderIndex: 1, included: true },
    { id: 'c3', type: 'typed', orderIndex: 2, included: true },
  ],
  questions: [
    { id: 'q1', categoryId: 'c1', type: 'typed', orderIndex: 0, points: 2 },
    { id: 'q2', categoryId: 'c2', type: 'typed', orderIndex: 0, points: 2 },
    { id: 'q3', categoryId: 'c3', type: 'typed', orderIndex: 0, points: 2 },
  ],
  players: [
    { id: 'ana', displayName: 'Ana', baseScore: 0, active: true },
    { id: 'bo', displayName: 'Bo', baseScore: 0, active: true },
  ],
  answers: [
    { id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 2 },
    { id: 'a2', questionId: 'q1', playerId: 'bo', pointsAwarded: 0 },
    { id: 'a3', questionId: 'q2', playerId: 'ana', pointsAwarded: 0 },
    { id: 'a4', questionId: 'q2', playerId: 'bo', pointsAwarded: 2 },
    { id: 'a5', questionId: 'q3', playerId: 'ana', pointsAwarded: 0 },
    { id: 'a6', questionId: 'q3', playerId: 'bo', pointsAwarded: 2 },
  ],
  votes: [],
  powerUps: [],
})

test('running totals add up round by round, and stop where you ask them to', () => {
  const game = threeRoundGame()
  const after1 = Object.fromEntries(scoresAfterRound(game, 0).map((t) => [t.id, t.score]))
  const after2 = Object.fromEntries(scoresAfterRound(game, 1).map((t) => [t.id, t.score]))
  const after3 = Object.fromEntries(scoresAfterRound(game, 2).map((t) => [t.id, t.score]))

  assert.deepEqual(after1, { ana: 2, bo: 0 })
  assert.deepEqual(after2, { ana: 2, bo: 2 })
  assert.deepEqual(after3, { ana: 2, bo: 4 })
})

test('the lead changing hands moves both badges, and both earn a card', () => {
  const game = threeRoundGame()

  // After round one Ana is alone on the board: Chief, and Bo on nothing.
  const r1 = badgesAfterRound(game, 0)
  assert.equal(r1.ana, 4)
  assert.equal(r1.bo, 0)

  // Round two levels them: both Chief.
  const r2 = badgesAfterRound(game, 1)
  assert.equal(r2.ana, 4)
  assert.equal(r2.bo, 4)

  // Round three puts Bo ahead 4-2. Ana is on half the lead, so she drops to
  // Private Eye and Bo keeps the top job.
  const moves = badgeMovesForRound(game, 2)
  assert.equal(moves.ana.direction, 'down')
  assert.equal(moves.ana.badge.name, 'Private Eye')
  assert.equal(earnsRankCard(moves.ana), true)
  assert.equal(moves.bo.direction, 'held')
  assert.equal(earnsRankCard(moves.bo), false)
})

test('before the first round has finished, everybody is a Beat Cop', () => {
  const game = threeRoundGame()
  assert.deepEqual(badgesAfterRound(game, -1), { ana: 0, bo: 0 })

  // Which means round one is where the first promotions happen.
  const moves = badgeMovesForRound(game, 0)
  assert.equal(moves.ana.direction, 'up')
  assert.equal(moves.ana.badge.name, 'Chief')
  assert.equal(moves.bo.direction, 'held')
})

test('a baseScore is carried into the running total', () => {
  const game = threeRoundGame()
  game.players[1].baseScore = 10
  const after1 = Object.fromEntries(scoresAfterRound(game, 0).map((t) => [t.id, t.score]))
  assert.deepEqual(after1, { ana: 2, bo: 10 })
})

// A staked round can take a player below zero on paper. The running total has
// to floor at nothing, the same way the real leaderboard does, or a badge gets
// worked out against a negative number.
test('a player who bet everything and lost is on nothing, not in the hole', () => {
  const game = {
    categories: [{ id: 'c1', type: 'wager', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'wager', orderIndex: 0, points: 2 }],
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: 5, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 20, active: true },
    ],
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', wager: 20, pointsAwarded: 0 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', wager: 5, pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [],
  }
  const after = Object.fromEntries(scoresAfterRound(game, 0).map((t) => [t.id, t.score]))
  assert.equal(after.ana, 0)
  assert.equal(after.bo, 25)
  assert.equal(badgesAfterRound(game, 0).ana, 0)
})

test('somebody who left the game is not counted or badged', () => {
  const game = threeRoundGame()
  game.players.push({ id: 'cal', displayName: 'Cal', baseScore: 0, active: false })
  const badges = badgesAfterRound(game, 2)
  assert.equal(badges.cal, undefined)
  assert.deepEqual(Object.keys(badges).sort(), ['ana', 'bo'])
})

test('a round the host left out of the running order is skipped', () => {
  const game = threeRoundGame()
  game.categories[1].included = false

  // Only c1 and c3 are in the running order now, so "round two" is c3.
  const after2 = Object.fromEntries(scoresAfterRound(game, 1).map((t) => [t.id, t.score]))
  assert.deepEqual(after2, { ana: 2, bo: 2 })
})

test('asking past the end of the running order does not run off it', () => {
  const game = threeRoundGame()
  const past = Object.fromEntries(scoresAfterRound(game, 99).map((t) => [t.id, t.score]))
  assert.deepEqual(past, { ana: 2, bo: 4 })
})
