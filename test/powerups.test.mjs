// Asserts that every card left in the decks actually does something - a
// scoring rule, a needsHost prompt, a payout, or a block - and that cards
// removed across both audits are gone for good (old saved games may still
// reference their keys, and findCard must return null for them rather than
// crashing anything).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POWER_UPS,
  LOSER_SUPPORT,
  deckForTier,
  applyPowerUps,
  findCard,
  dealOne,
  dealCards,
} from '../src/powerUps.js'

// A card counts as alive if it does ANY of: needs the host to act, hands over a
// payout, blocks incoming cards, or moves the points in at least one of these
// starting positions. Several positions are tried because a working card can
// legitimately do nothing from just one of them - Insurance only fires on a
// zero, Copycat moves nothing when both players scored the same.
function hasScoringEffect(key) {
  const answersById = { a: { id: 'a', playerId: 'me' }, b: { id: 'b', playerId: 'them' } }
  const positions = [
    { a: 1, b: 1 },
    { a: 0, b: 2 },
    { a: 2, b: 0 },
  ]
  return positions.some((before) => {
    const after = applyPowerUps({
      playedCards: [{ key, playerId: 'me', targetPlayerId: 'them', used: true }],
      pointsByAnswerId: { ...before },
      answersById,
      maxPoints: 2,
      leaderId: 'them',
    })
    return after.a !== before.a || after.b !== before.b
  })
}

test('every card in both decks does something', () => {
  const dead = []

  for (const deck of [POWER_UPS, LOSER_SUPPORT]) {
    for (const card of deck) {
      const alive =
        card.needsHost ||
        card.payout ||
        card.instant ||
        card.defensive ||
        card.autoTargetsLeader ||
        hasScoringEffect(card.key)

      if (!alive) dead.push(card.name)
    }
  }

  assert.deepEqual(dead, [])
})

test('tiers still slice both decks to the expected sizes', () => {
  assert.equal(deckForTier(POWER_UPS, 'basic').length, 5)
  assert.equal(deckForTier(POWER_UPS, 'advanced').length, 10)
  assert.equal(deckForTier(POWER_UPS, 'mayhem').length, POWER_UPS.length)

  assert.equal(deckForTier(LOSER_SUPPORT, 'basic').length, 5)
  assert.equal(deckForTier(LOSER_SUPPORT, 'advanced').length, LOSER_SUPPORT.length)
  assert.equal(deckForTier(LOSER_SUPPORT, 'mayhem').length, LOSER_SUPPORT.length)
})

test('cards removed across both audits stay gone', () => {
  const gone = [
    // First audit: dealt and spent for nothing.
    'secondchance', 'peek', 'spotlight',
    'underdog', 'sneakpeek', 'immunity', 'spotlightsteal', 'emojionly',
    // Second audit: only deliverable through the score fixer that was removed,
    // or a mechanism (reopen a question, reorder rounds) nobody wanted built.
    'secondwind', 'chooseround',
  ]
  const stillThere = gone.filter((key) => findCard(key))
  assert.deepEqual(stillThere, [])
})

test('Nothing to Lose doubles a hit and floors a miss at 1', () => {
  const answersById = { a: { id: 'a', playerId: 'me' } }
  const missed = applyPowerUps({
    playedCards: [{ key: 'nothingtolose', playerId: 'me', used: true }],
    pointsByAnswerId: { a: 0 },
    answersById,
    maxPoints: 2,
    leaderId: null,
  })
  assert.equal(missed.a, 1)

  const hit = applyPowerUps({
    playedCards: [{ key: 'nothingtolose', playerId: 'me', used: true }],
    pointsByAnswerId: { a: 1 },
    answersById,
    maxPoints: 2,
    leaderId: null,
  })
  assert.equal(hit.a, 2)
})

test('Coattails copies the current leader\'s points on this question', () => {
  const answersById = {
    mine: { id: 'mine', playerId: 'me' },
    theirs: { id: 'theirs', playerId: 'leader' },
  }
  const out = applyPowerUps({
    playedCards: [{ key: 'coattails', playerId: 'me', used: true }],
    pointsByAnswerId: { mine: 0, theirs: 2 },
    answersById,
    maxPoints: 2,
    leaderId: 'leader',
  })
  assert.equal(out.mine, 2)
})

test('Levelling zeroes its target if they somehow still have an answer', () => {
  const answersById = {
    a: { id: 'a', playerId: 'me' },
    b: { id: 'b', playerId: 'leader' },
  }
  const out = applyPowerUps({
    playedCards: [{ key: 'levelling', playerId: 'me', targetPlayerId: 'leader', used: true }],
    pointsByAnswerId: { a: 1, b: 2 },
    answersById,
    maxPoints: 2,
    leaderId: 'leader',
  })
  assert.equal(out.b, 0)
})

// --- Second-audit findings: multi-card and staked-round interactions -------

test('Handicap halves the leader once, even if two Handicap cards are played on the same question', () => {
  // Only reachable if the same card is dealt to two different players in one
  // round (possible when player count exceeds the tier's deck size and it
  // has to reshuffle mid-deal) and both play it. Halving twice was never the
  // intent - the card says "halved", not "halved again per copy in play".
  const answersById = { leaderAnswer: { id: 'leaderAnswer', playerId: 'leader' } }
  const out = applyPowerUps({
    playedCards: [
      { key: 'handicap', playerId: 'ana', used: true },
      { key: 'handicap', playerId: 'bo', used: true },
    ],
    pointsByAnswerId: { leaderAnswer: 4 },
    answersById,
    maxPoints: 2,
    leaderId: 'leader',
  })
  // Halved once (4 -> 2), not twice (4 -> 1).
  assert.equal(out.leaderAnswer, 2)
})

test('Safety Net and Nothing to Lose do not touch a staked round, even if somehow dealt into one', () => {
  // The scoring-time guard (`hasWager`) that backs up the deal-time exclusion
  // below - in a staked round pointsToScore() only checks whether points are
  // above zero to decide the whole stake, so bumping 0 to 1 would silently
  // turn a lost bet into a guaranteed win.
  const answersById = { a: { id: 'a', playerId: 'me' } }

  for (const key of ['safetynet', 'nothingtolose', 'insurance']) {
    const out = applyPowerUps({
      playedCards: [{ key, playerId: 'me', used: true }],
      pointsByAnswerId: { a: 0 },
      answersById,
      maxPoints: 2,
      leaderId: null,
      hasWager: true,
    })
    assert.equal(out.a, 0, key + ' should not floor a zero to 1 in a staked round')
  }
})

test('Free Swing does not double in a staked round (it would be a no-op there anyway)', () => {
  const answersById = { a: { id: 'a', playerId: 'me' } }
  const out = applyPowerUps({
    playedCards: [{ key: 'freeswing', playerId: 'me', used: true }],
    pointsByAnswerId: { a: 2 },
    answersById,
    maxPoints: 2,
    leaderId: null,
    hasWager: true,
  })
  assert.equal(out.a, 2)
})

test('Handicap and Veto still land even if the player who played them has no answer of their own', () => {
  // Both cards act on somebody ELSE - Handicap on whoever is leading, Veto on
  // an explicit target - and never touch the card-player's own answer. A
  // player can play either one before (or instead of) submitting their own
  // answer, since the hand and the answer box are on screen at the same
  // time; the card should still land on the other player regardless.
  const answersById = {
    leaderAnswer: { id: 'leaderAnswer', playerId: 'leader' },
    vetoTarget: { id: 'vetoTarget', playerId: 'victim' },
    // Note: no answer for 'ana' or 'bo', the two players playing the cards.
  }

  const handicapped = applyPowerUps({
    playedCards: [{ key: 'handicap', playerId: 'ana', used: true }],
    pointsByAnswerId: { leaderAnswer: 4, vetoTarget: 3 },
    answersById,
    maxPoints: 2,
    leaderId: 'leader',
  })
  assert.equal(handicapped.leaderAnswer, 2, 'Handicap should still halve the leader')

  const vetoed = applyPowerUps({
    playedCards: [{ key: 'veto', playerId: 'bo', targetPlayerId: 'victim', used: true }],
    pointsByAnswerId: { leaderAnswer: 4, vetoTarget: 3 },
    answersById,
    maxPoints: 2,
    leaderId: 'leader',
  })
  assert.equal(vetoed.vetoTarget, 0, 'Veto should still zero its target')
})

test('dealOne keeps staked-incompatible cards out of the pool when asked', () => {
  const staked = new Set()
  for (let i = 0; i < 200; i++) {
    const key = dealOne(LOSER_SUPPORT, 'advanced', { excludeStakedIncompatible: true })
    staked.add(key)
  }
  assert.ok(!staked.has('safetynet'), 'Safety Net should never be dealt for a staked round')
  assert.ok(!staked.has('nothingtolose'), 'Nothing to Lose should never be dealt for a staked round')
  assert.ok(!staked.has('freeswing'), 'Free Swing should never be dealt for a staked round')
  // Something must still come out - the pool should never go empty.
  assert.ok(staked.size > 0)
})

// ---------------------------------------------------------------------------
// DEALING, as changed on 22 August: a fresh hand for every question of a
// Power-Up Quiz rather than one card for the whole round.
// ---------------------------------------------------------------------------

test('a deal gives every player exactly one card', () => {
  const dealt = dealCards(POWER_UPS, 'mayhem', ['ana', 'bo', 'cal'])
  assert.equal(dealt.length, 3)
  assert.deepEqual(dealt.map((d) => d.playerId).sort(), ['ana', 'bo', 'cal'])
  dealt.forEach((d) => assert.ok(findCard(d.key), 'dealt a card that does not exist: ' + d.key))
})

// The reason "no two players hold the same card" can be true at all: cards in
// play never outnumber the deck, because nothing carries over.
test('nobody is dealt the same card as anybody else, while the deck allows it', () => {
  const deckSize = deckForTier(POWER_UPS, 'mayhem').length
  const players = Array.from({ length: Math.min(6, deckSize) }, (_, i) => 'p' + i)

  for (let run = 0; run < 50; run++) {
    const keys = dealCards(POWER_UPS, 'mayhem', players).map((d) => d.key)
    assert.equal(new Set(keys).size, keys.length, 'two players were handed the same card')
  }
})

// The whole point of dealing every question: the round has to feel like it is
// going somewhere, and three Ask the Guest of Honour in a row is not that.
test('a fresh deal avoids handing somebody back the card they are holding', () => {
  const holding = { ana: null }

  for (let question = 0; question < 40; question++) {
    const [dealt] = dealCards(POWER_UPS, 'mayhem', ['ana'], holding.ana ? { ana: holding.ana } : {})
    if (holding.ana) {
      assert.notEqual(dealt.key, holding.ana, 'dealt the same card two questions running')
    }
    holding.ana = dealt.key
  }
})

// A preference, not a promise. With a one-card deck a repeat is unavoidable,
// and a repeat beats being dealt nothing at all.
test('a one-card deck still deals, even though it must repeat', () => {
  const single = [POWER_UPS[0]]
  const dealt = dealCards(single, 'basic', ['ana'], { ana: POWER_UPS[0].key })
  assert.equal(dealt.length, 1)
  assert.equal(dealt[0].key, POWER_UPS[0].key)
})

test('dealing to nobody, or from an empty deck, returns nothing rather than throwing', () => {
  assert.deepEqual(dealCards(POWER_UPS, 'mayhem', []), [])
  assert.deepEqual(dealCards([], 'mayhem', ['ana']), [])
})
