// The Fibbage shuffle must not be biased towards putting the truth in any one
// position - that would let a sharp player learn to always guess slot 1.
// Reproduces src/roundTypes.js fibbageOptions ordering over many trials and
// checks the true answer lands roughly evenly across every slot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fibbageOptions, TRUTH_OPTION_ID } from '../src/roundTypes.js'

test('the true answer is not biased towards any position, over 20000 trials', () => {
  const TRIALS = 20000
  const PLAYERS = 5
  const counts = {}

  for (let t = 0; t < TRIALS; t++) {
    const question = { id: randomUUID(), trueAnswer: 'truth' }
    const answers = Array.from({ length: PLAYERS }, () => ({
      id: randomUUID(),
      text: 'lie',
      playerId: randomUUID(),
    }))
    const ordered = fibbageOptions(question, answers)
    const pos = ordered.findIndex((o) => o.id === TRUTH_OPTION_ID) + 1
    counts[pos] = (counts[pos] || 0) + 1
  }

  const slots = Object.keys(counts).length
  assert.equal(slots, PLAYERS + 1, 'the truth should land in every one of the 6 slots')

  for (const pos of Object.keys(counts)) {
    const share = counts[pos] / TRIALS
    // Loose bound - this is a fairness smoke test, not a statistical proof.
    // Anything under 10% or over 24% (expected is 16.7%) would mean a real bias.
    assert.ok(share > 0.1 && share < 0.24, `position ${pos} got ${(share * 100).toFixed(1)}% of trials`)
  }
})
