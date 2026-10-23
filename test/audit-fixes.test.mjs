// The three scoring rules the 31 August audit found were not actually enforced.
// Each of these failed before the fix and is here so it cannot come back.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  scoreFibbage,
  publishVoteOptions,
  fibbageOptions,
  truthOptionIdFrom,
  ballotFor,
  TRUTH_OPTION_ID,
} from '../src/roundTypes.js'
import { recomputeScores, effectiveScoring } from '../src/gameHelpers.js'

// --- You cannot fool yourself ----------------------------------------------
// The voting screen greys out your own lie. Greying out a button is not a
// rule: the audit sent the vote anyway and it scored, and the reveal screen
// then printed "Fooled Dez, Tomas" against Dez's own entry.

test('a vote for your own lie scores nothing', () => {
  const dez = randomUUID()
  const ana = randomUUID()
  const answers = [
    { id: 'a-dez', playerId: dez, text: 'Peanut' },
    { id: 'a-ana', playerId: ana, text: 'Mouse' },
  ]
  const votes = [{ playerId: dez, choiceId: 'a-dez' }]

  const points = scoreFibbage(answers, votes)
  assert.equal(points['a-dez'], 0, 'fooling yourself is not fooling anyone')
})

test('a vote for somebody else’s lie still credits them', () => {
  const dez = randomUUID()
  const ana = randomUUID()
  const answers = [
    { id: 'a-dez', playerId: dez, text: 'Peanut' },
    { id: 'a-ana', playerId: ana, text: 'Mouse' },
  ]
  const votes = [{ playerId: ana, choiceId: 'a-dez' }]

  assert.equal(scoreFibbage(answers, votes)['a-dez'], 1)
})

test('finding the truth is still worth two, through a published ballot', () => {
  const dez = randomUUID()
  const answers = [{ id: 'a-dez', playerId: dez, text: 'Peanut' }]
  const question = { id: 'q1', trueAnswer: 'Bubbles' }

  const { voteMap } = publishVoteOptions(fibbageOptions(question, answers))
  const truthId = truthOptionIdFrom(voteMap)

  const points = scoreFibbage(answers, [{ playerId: dez, choiceId: truthId }], voteMap)
  assert.equal(points['a-dez'], 2)
})

// --- The published ballot gives nothing away -------------------------------

test('the published ballot carries no id that marks the truth', () => {
  const answers = [
    { id: 'a-1', playerId: 'p1', text: 'Tiger' },
    { id: 'a-2', playerId: 'p2', text: 'Mouse' },
  ]
  const question = { id: 'q1', trueAnswer: 'Bubbles' }
  const { ballot, voteMap } = publishVoteOptions(fibbageOptions(question, answers))

  assert.equal(ballot.length, 3, 'two lies and the truth')

  for (const option of ballot) {
    assert.equal(Object.keys(option).sort().join(','), 'id,text', 'only an id and a text')
    assert.notEqual(option.id, TRUTH_OPTION_ID, 'nothing is labelled as the truth')
    // Nor may an id give it away by being the odd one out against the answers.
    assert.ok(!['a-1', 'a-2'].includes(option.id), 'ids are not the answer row ids')
  }

  // The truth is only findable with the key, which players are not sent.
  assert.ok(truthOptionIdFrom(voteMap), 'the host can still resolve it')
  assert.equal(truthOptionIdFrom(null), null, 'without the key, nobody can')
})

test('a question with no published ballot still falls back to the old one', () => {
  const answers = [{ id: 'a-1', playerId: 'p1', text: 'Tiger' }]
  const question = { id: 'q1', trueAnswer: 'Bubbles', items: null }
  const options = ballotFor(question, answers)
  assert.equal(options.length, 2)
})

// --- You cannot stake more than you hold -----------------------------------
// The slider caps the bet at your score and nothing behind it did. The audit
// staked 999 for a player holding 4 and she finished on 1003.

function stakedGame(wager) {
  const categoryId = 'c1'
  const questionId = 'q1'
  return {
    players: [
      { id: 'p1', displayName: 'Ana', baseScore: 0, active: true },
      { id: 'p2', displayName: 'Dez', baseScore: 0, active: true },
    ],
    categories: [{ id: categoryId, type: 'wager', included: true }],
    questions: [
      { id: questionId, categoryId, type: 'wager', orderIndex: 0, text: 'Q', points: 1 },
    ],
    // Ana holds 4 going in: two earlier judged answers are not modelled here,
    // so her base score carries it instead.
    answers: [{ id: 'ans1', questionId, playerId: 'p1', wager, pointsAwarded: 2 }],
    votes: [],
    powerUps: [],
  }
}

test('a stake larger than the player holds is capped at what they hold', () => {
  const game = stakedGame(999)
  game.players[0].baseScore = 4

  const { stakes } = effectiveScoring(game)
  assert.equal(stakes.ans1, 4, 'the bet is trimmed to the four she actually had')

  const scored = recomputeScores(game)
  const ana = scored.players.find((p) => p.id === 'p1')
  assert.equal(ana.score, 8, '4 held, 4 won - not 1003')
})

test('an honest stake is untouched', () => {
  const game = stakedGame(3)
  game.players[0].baseScore = 10

  assert.equal(effectiveScoring(game).stakes.ans1, 3)
  assert.equal(recomputeScores(game).players.find((p) => p.id === 'p1').score, 13)
})

test('losing a capped bet still cannot take anyone below zero', () => {
  const game = stakedGame(999)
  game.players[0].baseScore = 4
  game.answers[0].pointsAwarded = 0 // wrong answer, loses the stake

  const ana = recomputeScores(game).players.find((p) => p.id === 'p1')
  assert.equal(ana.score, 0)
})
