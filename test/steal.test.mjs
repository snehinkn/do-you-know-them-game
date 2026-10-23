// Steal's card text says "if you are both right, you take their points as
// well as your own" (AUDIT.md finding #10 - the old text described taking
// nothing). Checks the card does what the current text says, not what the
// old text used to say.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPowerUps } from '../src/powerUps.js'

const answersById = {
  a: { id: 'a', playerId: 'ana' },
  b: { id: 'b', playerId: 'bo' },
}
const card = { key: 'steal', playerId: 'ana', targetPlayerId: 'bo', used: true }

function run(anaPts, boPts) {
  return applyPowerUps({
    playedCards: [card],
    pointsByAnswerId: { a: anaPts, b: boPts },
    answersById,
    maxPoints: 2,
    leaderId: null,
  })
}

test('both right: Ana takes Bo\'s points as well as her own', () => {
  assert.deepEqual(run(2, 2), { a: 4, b: 0 })
})

test('Ana right, Bo wrong: nothing to steal, so nothing happens', () => {
  assert.deepEqual(run(2, 0), { a: 2, b: 0 })
})

test('Ana wrong: the card is spent for nothing regardless of Bo', () => {
  assert.deepEqual(run(0, 2), { a: 0, b: 2 })
})
