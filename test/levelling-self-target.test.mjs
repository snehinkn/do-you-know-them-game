// Levelling always hits "the leader" with nobody picking a target - but
// nothing used to stop the leader herself holding the card and playing it,
// which sat HER out rather than the person the card exists to knock down.
// `autoLevellingTarget` steps down to second place when the activator is the
// leader; otherwise it behaves exactly as before.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoLevellingTarget } from '../src/gameHelpers.js'

function game(players) {
  return { players: players.map((p) => ({ ...p, active: true })) }
}

test('targets the leader as normal when someone else plays the card', () => {
  const g = game([
    { id: 'leader', displayName: 'Leader', score: 10 },
    { id: 'chaser', displayName: 'Chaser', score: 4 },
  ])
  assert.equal(autoLevellingTarget(g, 'chaser'), 'leader')
})

test('steps down to second place when the leader plays the card on herself', () => {
  const g = game([
    { id: 'leader', displayName: 'Leader', score: 10 },
    { id: 'second', displayName: 'Second', score: 6 },
    { id: 'third', displayName: 'Third', score: 2 },
  ])
  assert.equal(autoLevellingTarget(g, 'leader'), 'second')
})

test('a leader alone in the game has nobody to hand it to', () => {
  const g = game([{ id: 'leader', displayName: 'Leader', score: 10 }])
  assert.equal(autoLevellingTarget(g, 'leader'), null)
})

test('a tie for the lead reads the same way rankedPlayers does everywhere else', () => {
  // Both on 10; rankedPlayers is a stable sort so join order (list order here)
  // decides which of the tied pair is "the leader" for this purpose too.
  const g = game([
    { id: 'first-in-list', displayName: 'A', score: 10 },
    { id: 'second-in-list', displayName: 'B', score: 10 },
  ])
  assert.equal(autoLevellingTarget(g, 'someone-else'), 'first-in-list')
  // And if the one the tie-break picked as leader is the activator, it steps
  // down to the other tied player rather than targeting nobody.
  assert.equal(autoLevellingTarget(g, 'first-in-list'), 'second-in-list')
})

test('nobody in the game at all does not throw', () => {
  assert.equal(autoLevellingTarget(game([]), 'anyone'), null)
})
