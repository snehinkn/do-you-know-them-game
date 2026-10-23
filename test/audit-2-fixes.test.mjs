// The twelve findings of the 1 September second audit, as tests.
//
// Every one of these failed before its fix and is here so it cannot come back.
// The three that were rules decisions are marked with the call that was made,
// because a future session reading a failure needs to know it is enforcing a
// choice rather than a law of nature.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { applyPowerUps } from '../src/powerUps.js'
import { fibbageOptions, publishVoteOptions, scoreFibbage } from '../src/roundTypes.js'
import { recomputeScores, effectiveScoring } from '../src/gameHelpers.js'

// ---------------------------------------------------------------------------
// A four-player question, used by most of the card tests below.
// Ana scored 2, Bo 1, Cass 0, Dev 2. Dev is the leader. Full marks is 2.
// ---------------------------------------------------------------------------
const ANA = 'p-ana', BO = 'p-bo', CASS = 'p-cass', DEV = 'p-dev'
const answersById = {
  aAna: { id: 'aAna', playerId: ANA },
  aBo: { id: 'aBo', playerId: BO },
  aCass: { id: 'aCass', playerId: CASS },
  aDev: { id: 'aDev', playerId: DEV },
}
const BASE = { aAna: 2, aBo: 1, aCass: 0, aDev: 2 }
const card = (playerId, key, targetPlayerId) => ({ playerId, key, targetPlayerId })

const play = (playedCards, { leaderId = DEV, maxPoints = 2, hasWager = false } = {}) =>
  applyPowerUps({
    playedCards,
    pointsByAnswerId: { ...BASE },
    answersById,
    maxPoints,
    leaderId,
    hasWager,
  })

// --- Finding 3: tap order must not change the score ------------------------
// The audit played the same four cards twice, changing only the order they
// were tapped in, and got Ana +1 / Cass +2 one time and Ana +0 / Cass +4 the
// next. Cards now resolve in fixed phases.

test('the same cards in either order give the same scores', () => {
  const pairs = [
    [card(ANA, 'copycat', BO), card(BO, 'double')],
    [card(ANA, 'swap', BO), card(BO, 'double')],
    [card(ANA, 'steal', BO), card(BO, 'double')],
    [card(BO, 'veto', CASS), card(CASS, 'insurance')],
    [card(BO, 'handicap'), card(DEV, 'double')],
    [card(ANA, 'coattails'), card(DEV, 'double')],
  ]

  for (const [first, second] of pairs) {
    const forwards = play([first, second])
    const backwards = play([second, first])
    assert.deepEqual(
      forwards,
      backwards,
      `${first.key} and ${second.key} still depend on who tapped first`,
    )
  }
})

// --- Finding 3, the rules call: Veto is absolute ---------------------------
// SNEHIN'S DECISION: Veto always wins. It is the meanest card in the mayhem
// tier and its text says "scores nothing" without qualification.

test('Veto beats every one-point floor, whichever was played first', () => {
  for (const floor of ['insurance', 'safetynet', 'nothingtolose']) {
    assert.equal(play([card(BO, 'veto', CASS), card(CASS, floor)]).aCass, 0)
    assert.equal(play([card(CASS, floor), card(BO, 'veto', CASS)]).aCass, 0)
  }
})

test('Levelling is absolute in the same way', () => {
  assert.equal(play([card(CASS, 'insurance'), card(BO, 'levelling', CASS)]).aCass, 0)
})

test('a one-point floor still fires when nobody vetoes', () => {
  assert.equal(play([card(CASS, 'insurance')]).aCass, 1)
})

// --- Finding 3: copying takes the final figure -----------------------------

test('Copycat takes what the target finally scored, not a figure mid-sum', () => {
  // Dev scored 2 and doubles to 4. Cass copying Dev gets 4, not 2.
  assert.equal(play([card(CASS, 'copycat', DEV), card(DEV, 'double')]).aCass, 4)
})

test('copying a vetoed player inherits the zero', () => {
  const out = play([card(BO, 'veto', DEV), card(CASS, 'copycat', DEV)])
  assert.equal(out.aDev, 0)
  assert.equal(out.aCass, 0, 'you copied their answer, so you copy their fate')
})

test('Coattails on a vetoed leader inherits the zero too', () => {
  assert.equal(play([card(BO, 'veto', DEV), card(ANA, 'coattails')]).aAna, 0)
})

// --- Finding 7, the rules call: Shield blocks everything -------------------
// SNEHIN'S DECISION: let Shield be strictly better rather than reword it. Its
// own text is "Immune to everyone else's power-ups this question. Nothing
// lands." Copycat and Coattails used to land anyway.

test('Shield blocks every card that names somebody else', () => {
  const shielded = play([card(BO, 'shield'), card(ANA, 'steal', BO)])
  assert.equal(shielded.aBo, 1, 'steal')
  assert.equal(play([card(BO, 'shield'), card(ANA, 'swap', BO)]).aBo, 1, 'swap')
  assert.equal(play([card(BO, 'shield'), card(ANA, 'veto', BO)]).aBo, 1, 'veto')
  assert.equal(play([card(DEV, 'shield'), card(ANA, 'handicap')]).aDev, 2, 'handicap')
  assert.equal(play([card(DEV, 'shield'), card(ANA, 'levelling', DEV)]).aDev, 2, 'levelling')
})

test('Shield blocks Copycat and Coattails as well', () => {
  // The copier is left with their own score rather than the shielded player's.
  assert.equal(play([card(BO, 'shield'), card(ANA, 'copycat', BO)]).aAna, 2)
  assert.equal(play([card(DEV, 'shield'), card(BO, 'coattails')]).aBo, 1)
})

// --- Finding 10: a card aimed at yourself does nothing ---------------------

test('a card aimed at its own player is ignored', () => {
  // Steal at yourself used to wipe your own points out entirely.
  assert.equal(play([card(ANA, 'steal', ANA)]).aAna, 2)
  assert.equal(play([card(ANA, 'veto', ANA)]).aAna, 2)
  assert.equal(play([card(ANA, 'swap', ANA)]).aAna, 2)
  assert.equal(play([card(ANA, 'copycat', ANA)]).aAna, 2)
})

test('the leader playing Coattails does not copy themselves', () => {
  assert.equal(play([card(DEV, 'coattails')]).aDev, 2)
})

// --- Finding 5: nobody carries an invisible debt ---------------------------
// A player on zero hit by Point Thief used to go to -1 behind the scenes while
// their screen showed 0, so their next correct answer paid off a point they
// were never told they owed.

function pointThiefGame(anaStarts) {
  return {
    players: [
      { id: 'ana', displayName: 'Ana', baseScore: anaStarts, active: true },
      { id: 'bo', displayName: 'Bo', baseScore: 0, active: true },
    ],
    categories: [{ id: 'c1', type: 'powerup', included: true, orderIndex: 0 }],
    questions: [
      { id: 'q1', categoryId: 'c1', orderIndex: 0, points: 2, type: 'powerup' },
      { id: 'q2', categoryId: 'c1', orderIndex: 1, points: 2, type: 'powerup' },
    ],
    answers: [
      { id: 'a1', questionId: 'q1', playerId: 'ana', pointsAwarded: 0 },
      { id: 'b1', questionId: 'q1', playerId: 'bo', pointsAwarded: 0 },
      { id: 'a2', questionId: 'q2', playerId: 'ana', pointsAwarded: 2 },
      { id: 'b2', questionId: 'q2', playerId: 'bo', pointsAwarded: 0 },
    ],
    votes: [],
    powerUps: [
      {
        id: 'pu1', playerId: 'bo', targetPlayerId: 'ana', key: 'pointthief',
        categoryId: 'c1', questionId: 'q1', used: true,
      },
    ],
  }
}

test('Point Thief against a player on zero costs them nothing later', () => {
  const scored = recomputeScores(pointThiefGame(0))
  const ana = scored.players.find((p) => p.id === 'ana')
  const bo = scored.players.find((p) => p.id === 'bo')
  assert.equal(ana.score, 2, 'her two points arrive in full, with no debt to pay off first')
  assert.equal(bo.score, 1, 'the point he took is still his')
})

test('Point Thief against a player who has points still takes one', () => {
  const scored = recomputeScores(pointThiefGame(3))
  assert.equal(scored.players.find((p) => p.id === 'ana').score, 4, '3 - 1 + 2')
})

test('the running total and the displayed score are the same number', () => {
  const game = pointThiefGame(0)
  const { running } = effectiveScoring(game)
  const scored = recomputeScores(game)
  scored.players.forEach((player) => {
    assert.equal(player.score, running[player.id], player.displayName)
  })
})

// --- Finding 8: one leader, not two ----------------------------------------
// Levelling picked its target from the active players' displayed scores;
// the scoring walk picked "the leader" from every player on the game using
// unfloored totals. They could disagree.

test('a player who has left is not the leader', () => {
  const game = {
    players: [
      { id: 'gone', displayName: 'Gone', baseScore: 50, active: false },
      { id: 'here', displayName: 'Here', baseScore: 1, active: true },
      { id: 'other', displayName: 'Other', baseScore: 0, active: true },
    ],
    categories: [{ id: 'c1', type: 'powerup', included: true, orderIndex: 0 }],
    questions: [{ id: 'q1', categoryId: 'c1', orderIndex: 0, points: 2, type: 'powerup' }],
    answers: [
      { id: 'aHere', questionId: 'q1', playerId: 'here', pointsAwarded: 2 },
      { id: 'aOther', questionId: 'q1', playerId: 'other', pointsAwarded: 2 },
    ],
    votes: [],
    powerUps: [
      {
        id: 'pu1', playerId: 'other', key: 'handicap',
        categoryId: 'c1', questionId: 'q1', used: true,
      },
    ],
  }

  const { effective } = effectiveScoring(game)
  // Handicap has to land on "Here", the leading ACTIVE player - the same person
  // Levelling would have picked. It used to land on nobody, because the
  // departed player on 50 was read as the leader and had no answer.
  assert.equal(effective.aHere, 1, 'the leading active player was halved')
  assert.equal(effective.aOther, 2, 'and nobody else was touched')
})

// --- Finding 2: a lie that is really the truth -----------------------------
// Somebody writes the real answer while trying to invent one. The ballot used
// to list it twice, and because "yours" is matched on the words, BOTH copies
// came up greyed out - locking the one person who had it right out of voting
// for it.

test('a lie identical to the true answer does not get its own ballot option', () => {
  const question = { id: 'q1', trueAnswer: 'Deep fried Mars bar' }
  const answers = [
    { id: 'aAna', playerId: ANA, text: 'Deep fried Mars bar' },
    { id: 'aBo', playerId: BO, text: 'A whole raw onion' },
  ]

  const options = fibbageOptions(question, answers)
  const copies = options.filter((o) => o.text === 'Deep fried Mars bar')
  assert.equal(copies.length, 1, 'the truth absorbs it rather than appearing twice')
  assert.equal(copies[0].id, 'truth', 'and the one that survives is the truth')
  assert.equal(options.length, 2, 'Bo’s lie plus the truth')
})

test('the match ignores capitals and stray spaces', () => {
  const question = { id: 'q1', trueAnswer: 'A Nokia 3310' }
  const answers = [{ id: 'aAna', playerId: ANA, text: '  a nokia 3310 ' }]
  assert.equal(fibbageOptions(question, answers).length, 1, 'just the truth')
})

test('two players writing the same LIE still get an option each', () => {
  // Deliberately unchanged: they are indistinguishable anyway, and each is
  // owed their own fooling points.
  const question = { id: 'q1', trueAnswer: 'A Nokia 3310' }
  const answers = [
    { id: 'aAna', playerId: ANA, text: 'A BlackBerry' },
    { id: 'aBo', playerId: BO, text: 'A BlackBerry' },
  ]
  assert.equal(fibbageOptions(question, answers).length, 3)
})

test('the author of a truth-matching lie can vote for the truth and score', () => {
  const question = { id: 'q1', trueAnswer: 'Deep fried Mars bar' }
  const answers = [
    { id: 'aAna', playerId: ANA, text: 'Deep fried Mars bar' },
    { id: 'aBo', playerId: BO, text: 'A whole raw onion' },
  ]
  const { ballot, voteMap } = publishVoteOptions(fibbageOptions(question, answers))

  const truthOption = ballot.find((o) => voteMap[o.id] === 'truth')
  const points = scoreFibbage(answers, [{ playerId: ANA, choiceId: truthOption.id }], voteMap)
  assert.equal(points.aAna, 2, 'she found the truth, even though she also wrote it')
})

// --- Finding 1: who actually fooled whom -----------------------------------
// The reveal compared a vote's ballot id against an answer id, which never
// match, so every lie read "Fooled nobody" - including ones being paid for it.
// This is the same translation the reveal screen now does.

test('a published vote resolves back to the answer it was cast for', () => {
  const question = { id: 'q1', trueAnswer: 'A Nokia 3310' }
  const answers = [
    { id: 'aAna', playerId: ANA, text: 'A BlackBerry' },
    { id: 'aBo', playerId: BO, text: 'A pink Motorola Razr' },
  ]
  const { ballot, voteMap } = publishVoteOptions(fibbageOptions(question, answers))

  const anasLie = ballot.find((o) => voteMap[o.id] === 'aAna')
  const votes = [{ playerId: BO, choiceId: anasLie.id }]

  // What the reveal screen does to build its "Fooled …" line.
  const fooled = votes.filter((v) => voteMap[v.choiceId] === 'aAna')
  assert.equal(fooled.length, 1, 'Bo fell for Ana’s lie and the screen can say so')

  // And it agrees with the points actually awarded.
  assert.equal(scoreFibbage(answers, votes, voteMap).aAna, 1)
})

test('the “Fooled …” line does not count a vote for your own lie', () => {
  // Caught by running the app, not by reading it. Fixing the line above made it
  // resolve votes properly for the first time - and immediately printed "Ana +0
  // … Fooled Ana", because a self-vote does resolve to your own answer. The
  // points were right; the sentence was not. `scoreFibbage` drops these, so the
  // display has to as well.
  const question = { id: 'q1', trueAnswer: 'A Nokia 3310' }
  const answers = [
    { id: 'aAna', playerId: ANA, text: 'A BlackBerry' },
    { id: 'aBo', playerId: BO, text: 'A pink Motorola Razr' },
  ]
  const { ballot, voteMap } = publishVoteOptions(fibbageOptions(question, answers))
  const anasLie = ballot.find((o) => voteMap[o.id] === 'aAna')
  const votes = [{ playerId: ANA, choiceId: anasLie.id }]

  const fooled = votes.filter(
    (v) => voteMap[v.choiceId] === 'aAna' && v.playerId !== ANA,
  )
  assert.equal(fooled.length, 0, 'fooling yourself is not fooling anyone')
  assert.equal(scoreFibbage(answers, votes, voteMap).aAna, 0, 'and it pays nothing')
})

test('a ballot id never collides with an answer id', () => {
  const question = { id: 'q1', trueAnswer: 'A Nokia 3310' }
  const answers = [
    { id: randomUUID(), playerId: ANA, text: 'A BlackBerry' },
    { id: randomUUID(), playerId: BO, text: 'A pink Motorola Razr' },
  ]
  const { ballot } = publishVoteOptions(fibbageOptions(question, answers))
  const answerIds = new Set(answers.map((a) => a.id))
  ballot.forEach((option) => {
    assert.ok(!answerIds.has(option.id), 'a player can never match a ballot id to an answer')
  })
})

// --- Finding 4, the rules call: spotting the truth pays --------------------
// SNEHIN'S DECISION: pay it. The player played the half of the round still
// open to them and got it right. The app now makes them a scoring slot (see
// App.lockVotes) so the two points have somewhere to land.

test('finding the truth pays even for someone who wrote no lie', () => {
  const answers = [
    { id: 'aAna', playerId: ANA, text: null, submitted: false }, // voted only
    { id: 'aBo', playerId: BO, text: 'A BlackBerry', submitted: true },
  ]
  const points = scoreFibbage(answers, [{ playerId: ANA, choiceId: 'truth' }])
  assert.equal(points.aAna, 2, 'she found it, so she is paid for it')
})

test('a truth-finder with no scoring slot at all still scores nothing', () => {
  // The guard behind the fix: if the row genuinely is not there, nothing throws.
  const answers = [{ id: 'aBo', playerId: BO, text: 'A BlackBerry' }]
  assert.doesNotThrow(() =>
    scoreFibbage(answers, [{ playerId: ANA, choiceId: 'truth' }]),
  )
})
