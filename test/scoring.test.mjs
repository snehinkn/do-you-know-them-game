// Regression check: rebuilds the exact scoring situations that were
// hand-checked during the first audit's live playthrough, and asserts the app
// still produces the same totals. Also checks the round leaderboard, which
// used to disagree with the totals whenever a card was played (AUDIT.md #7/#8).
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recomputeScores, categoryLeaderboard } from '../src/gameHelpers.js'

const players = () => [
  { id: 'ana', displayName: 'Ana', baseScore: 0, active: true },
  { id: 'bo', displayName: 'Bo', baseScore: 0, active: true },
  { id: 'cal', displayName: 'Cal', baseScore: 0, active: true },
]
const totals = (g) => Object.fromEntries(recomputeScores(g).players.map((p) => [p.id, p.score]))
const roundBoard = (g, c) => Object.fromEntries(categoryLeaderboard(g, c).map((p) => [p.id, p.score]))

test('plain typed round, no cards - the baseline that must not move', () => {
  const game = {
    categories: [{ id: 'c1', type: 'typed', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'typed', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 2 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', pointsAwarded: 1 },
      { id: 'a3', questionId: 'q1', playerId: 'cal', pointsAwarded: 0 },
    ],
    votes: [],
    powerUps: [],
  }
  assert.deepEqual(totals(game), { ana: 2, bo: 1, cal: 0 })
  assert.deepEqual(roundBoard(game, 'c1'), { ana: 2, bo: 1, cal: 0 })
})

test('unjudged answers score nothing and do not crash', () => {
  const game = {
    categories: [{ id: 'c1', type: 'typed', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'typed', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 2 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', pointsAwarded: null },
    ],
    votes: [],
    powerUps: [],
  }
  assert.deepEqual(totals(game), { ana: 2, bo: 0, cal: 0 })
})

test('Double Down doubles the total, and the round board agrees (finding 7)', () => {
  const game = {
    categories: [{ id: 'c1', type: 'powerup', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'powerup', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 1 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [{ id: 'p1', playerId: 'ana', categoryId: 'c1', key: 'double', questionId: 'q1', used: true }],
  }
  assert.deepEqual(totals(game), { ana: 2, bo: 2, cal: 0 })
  assert.deepEqual(roundBoard(game, 'c1'), { ana: 2, bo: 2, cal: 0 })
})

test('Head Start is an instant +2 and lands on the right round', () => {
  const game = {
    categories: [{ id: 'c1', type: 'powerup', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'powerup', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [{ id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 1 }],
    votes: [],
    powerUps: [{ id: 'p1', playerId: 'ana', categoryId: 'c1', key: 'headstart', questionId: 'q1', used: true }],
  }
  assert.deepEqual(totals(game), { ana: 3, bo: 0, cal: 0 })
  assert.deepEqual(roundBoard(game, 'c1'), { ana: 3, bo: 0, cal: 0 })
})

test('All or Nothing lifts a half-right answer to full marks', () => {
  const game = {
    categories: [{ id: 'c1', type: 'powerup', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'powerup', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [{ id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 1 }],
    votes: [],
    powerUps: [{ id: 'p1', playerId: 'ana', categoryId: 'c1', key: 'allornothing', questionId: 'q1', used: true }],
  }
  assert.deepEqual(totals(game), { ana: 2, bo: 0, cal: 0 })
})

test('wager round: win the stake, lose the stake, never go negative', () => {
  const game = {
    categories: [{ id: 'c1', type: 'wager', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'wager', orderIndex: 0, points: 3 }],
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: 33, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 18, active: true },
      { id: 'cal', displayName: 'Cal', baseScore: 23, active: true },
    ],
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', wager: 0, pointsAwarded: 2 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', wager: 18, pointsAwarded: 0 },
      { id: 'a3', questionId: 'q1', playerId: 'cal', wager: 10, pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [],
  }
  assert.deepEqual(totals(game), { ana: 33, bo: 0, cal: 33 })
  assert.deepEqual(roundBoard(game, 'c1'), { ana: 0, bo: -18, cal: 10 })
})

test('auction: only the winning bidder is scored', () => {
  const game = {
    categories: [{ id: 'c1', type: 'auction', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'auction', orderIndex: 0, points: 0 }],
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: 21, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 24, active: true },
      { id: 'cal', displayName: 'Cal', baseScore: 21, active: true },
    ],
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', bid: 10, submitted: true, pointsAwarded: 2 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', bid: 10, submitted: true, pointsAwarded: 0 },
      { id: 'a3', questionId: 'q1', playerId: 'cal', bid: 5, submitted: false, pointsAwarded: null },
    ],
    votes: [],
    powerUps: [],
  }
  assert.deepEqual(totals(game), { ana: 31, bo: 14, cal: 21 })
})

test('a payout card (Wildcard) adds nothing until awardPoints is set, then adds exactly that', () => {
  const game = {
    categories: [{ id: 'c1', type: 'powerup', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'powerup', orderIndex: 0, points: 2 }],
    players: players(),
    answers: [{ id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 1 }],
    votes: [],
    powerUps: [
      {
        id: 'p1',
        playerId: 'ana',
        categoryId: 'c1',
        key: 'wildcard',
        questionId: 'q1',
        used: true,
        awardPoints: null,
      },
    ],
  }
  assert.deepEqual(totals(game), { ana: 1, bo: 0, cal: 0 })

  game.powerUps[0].awardPoints = 4
  assert.deepEqual(totals(game), { ana: 5, bo: 0, cal: 0 })
  assert.deepEqual(roundBoard(game, 'c1'), { ana: 5, bo: 0, cal: 0 })

  // Tapping a different payout overwrites rather than stacking.
  game.powerUps[0].awardPoints = 0
  assert.deepEqual(totals(game), { ana: 1, bo: 0, cal: 0 })
})

test('Safety Net does not turn a lost wager into a guaranteed win, end to end', () => {
  // Second-audit finding: pointsToScore() for a staked round only checks
  // whether points are above zero to decide the whole stake, so a card that
  // floors a wrong answer to 1 point would otherwise flip a loss into a win.
  // This exercises the real pipeline (effectivePointsByAnswer ->
  // recomputeScores), not just applyPowerUps in isolation, so it also proves
  // roundTypeFor(question).hasWager is actually reaching the guard.
  const game = {
    categories: [{ id: 'c1', type: 'wager', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'wager', orderIndex: 0, points: 3 }],
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: 20, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 20, active: true },
    ],
    answers: [
      // Ana bet 15 and got it wrong (pointsAwarded 0 - would normally lose the 15).
      { id: 'a1', questionId: 'q1', playerId: 'ana', wager: 15, pointsAwarded: 0 },
      { id: 'a2', questionId: 'q1', playerId: 'bo', wager: 10, pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [
      { id: 'p1', playerId: 'ana', categoryId: 'c1', key: 'safetynet', questionId: 'q1', used: true },
    ],
  }
  const result = Object.fromEntries(recomputeScores(game).players.map((p) => [p.id, p.score]))
  // Without the guard this would be { ana: 35, bo: 30 } - a wrong answer
  // silently winning the whole 15-point bet. With it, Ana still loses her bet.
  assert.deepEqual(result, { ana: 5, bo: 30 })
})

test('re-judging the same answer five times does not drift', () => {
  const game = {
    categories: [{ id: 'c1', type: 'typed', orderIndex: 0, included: true }],
    questions: [{ id: 'q1', categoryId: 'c1', type: 'typed', orderIndex: 0, points: 2 }],
    players: [{ id: 'ana', displayName: 'Ana', baseScore: 5, active: true }],
    answers: [{ id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 2 }],
    votes: [],
    powerUps: [],
  }
  let last
  for (const v of [2, 0, 1, 2, 1]) {
    game.answers[0].pointsAwarded = v
    last = totals(game)
  }
  assert.deepEqual(last, { ana: 6 })
})
