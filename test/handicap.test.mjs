// Uses the app's real scoring code to check who "the current leader" is when
// a Handicap card fires. AUDIT.md finding #11: the leader used to be worked
// out before any points were added, so everyone looked tied on zero and it
// hit whoever was first in the list - usually the person who played it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recomputeScores } from '../src/gameHelpers.js'

test('Handicap halves the real leader, not the first player in the list', () => {
  // Q1 makes Bo the clear leader (Bo 2, Ana 0).
  // On Q2, Ana plays Handicap. The leader at that moment is Bo. Bo scores 2 on
  // Q2, so Bo should end on 2 + 1 = 3, and Ana on 0 + 2 = 2.
  const game = {
    id: 'g1',
    currentQuestionId: 'q2',
    categories: [{ id: 'c1', type: 'powerup', orderIndex: 0, included: true }],
    questions: [
      { id: 'q1', categoryId: 'c1', type: 'powerup', orderIndex: 0, points: 2, text: 'Q1' },
      { id: 'q2', categoryId: 'c1', type: 'powerup', orderIndex: 1, points: 2, text: 'Q2' },
    ],
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: 0, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 0, active: true },
    ],
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', submitted: true, pointsAwarded: 0 },
      { id: 'b1', questionId: 'q1', playerId: 'bo', submitted: true, pointsAwarded: 2 },
      { id: 'a2', questionId: 'q2', playerId: 'ana', submitted: true, pointsAwarded: 2 },
      { id: 'b2', questionId: 'q2', playerId: 'bo', submitted: true, pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [
      {
        id: 'p1',
        playerId: 'ana',
        categoryId: 'c1',
        deck: 'power',
        key: 'handicap',
        questionId: 'q2',
        targetPlayerId: null,
        used: true,
      },
    ],
  }

  const totals = Object.fromEntries(recomputeScores(game).players.map((p) => [p.id, p.score]))
  assert.deepEqual(totals, { ana: 2, bo: 3 })
})
