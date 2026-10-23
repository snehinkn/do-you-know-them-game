import { shuffle } from './shuffle.js'

// ---------------------------------------------------------------------------
// POWER-UPS
//
// Two separate decks:
//   POWER_UPS         dealt to everyone during a Power-Up Quiz round
//   LOSER_SUPPORT     dealt to whoever came last, used in the next round
//
// EVERY CARD HERE DOES SOMETHING. Eight cards were removed after the first
// audit, because they were dealt and spent and then had no effect whatsoever -
// no scoring rule behind them and nothing on screen either. A player spending
// their one card of the round on nothing, with no explanation, is worse than a
// smaller deck. Anything added back needs either a rule in `applyPowerUps`
// below, a `needsHost` prompt so the guest of honour can make it happen out
// loud, or a
// `payout` (see below) she can tap once she has.
//
// The eight removed after the first audit, in case they are ever built: Second
// Chance and Peek and Spotlight from this deck; The Underdog, Sneak Peek,
// Immunity, Steal the Spotlight and Emoji Only from the loser deck.
//
// The second audit found three more cards that were "deliverable" only by
// misusing a free-form score fixer that has since been removed entirely (it
// let the judge hand out any number to anyone, for any reason - a wide-open door
// nobody wanted left in the app). Rather than lose Wildcard, Bonus Question and
// Vote of Confidence too, each now carries `payout: true` and a short fixed
// list of `payoutOptions` - the exact amounts the card text promises, and
// nothing else. She still speaks first (the `needsHost` prompt), then taps the
// matching payout button on the reveal screen once she has decided. See
// `CardPayouts.jsx`.
//
// Second Wind and Choose the Round were rewritten rather than kept: Second Wind
// needed something reopening a scored question, which touches the state
// machine for one card's sake; Choose the Round needed round reordering for a
// card that would not have been fun anyway, because the round gets played
// either way, just in a different order. Nothing to Lose and Coattails replace
// them in the same deck positions, so the tier boundaries do not move.
// Levelling was rewritten from a "say it out loud" card into a real mechanic -
// see `autoTargetsLeader` below.
//
// TIERS. Each deck is split into three nested levels, chosen once at setup.
// Higher tiers CONTAIN the lower ones, and a tier is simply the first N cards:
//   basic     cards 1-5    the straightforward ones
//   advanced  cards 1-10   adds targeting and the ones aimed at other people
//   mayhem    everything   adds the ones that will start arguments
//
// The numbers are cut-off points, not deck sizes - the two decks are different
// lengths, so nothing here should ever claim "all fifteen".
//
// DEALING. One card per player, dealt fresh for EVERY QUESTION of a Power-Up
// Quiz, drawn without duplicates and preferring something the player is not
// already holding. An unused card does not carry over - the next question
// replaces it.
//
// This changed on 22 August. It used to be one card for the whole round, which
// made the round a single hold-or-spend decision and left the remaining
// questions as ordinary typed answers with nothing to play. Dealing every
// question makes each one its own decision, which is the point of the round.
//
// Expiring rather than accumulating is what keeps "no two players hold the
// same card" true: cards in play can never outnumber the deck.
//
// ONE CARD PER QUESTION. You may hold two - a dealt one and a mercy card - but
// only one can be spent on any single question, which is the rule as written.
//
// TIMING. Some cards act before answers lock (a hint is useless afterwards),
// others when points are worked out (doubling). Both are supported.
// ---------------------------------------------------------------------------

// There is no "off". The Power-Up round is defined by having power-ups, so
// switching them off would just leave an ordinary typed round wearing its name.
// Choosing not to play them is what the round toggle in setup is for.
export const TIERS = {
  basic: {
    key: 'basic',
    label: 'Basic',
    size: 5,
    blurb: 'The straightforward ones. Nothing that needs explaining twice.',
  },
  advanced: {
    key: 'advanced',
    label: 'Advanced',
    size: 10,
    blurb: 'Adds the cards you aim at somebody else.',
  },
  mayhem: {
    key: 'mayhem',
    label: 'Mayhem',
    size: 99,
    blurb: 'Every card, including the ones that will start arguments.',
  },
}

// When a card takes effect.
export const TIMING = {
  ON_PLAY: 'on_play', // immediately, before the player answers
  ON_SCORE: 'on_score', // when points are worked out
}

// ---------------------------------------------------------------------------
// DECK A - the Power-Up Quiz
// Order matters: the first 5 are Basic, the first 10 are Advanced, all 15 are
// Mayhem. Reordering this list changes what each tier contains.
// ---------------------------------------------------------------------------

export const POWER_UPS = [
  // --- Basic: no targets. Nothing here is aimed at another player.
  //     The two that ask the guest of honour for a word are in this tier now:
//     they are the
  //     easiest of the lot to explain out loud, and with the dead cards gone
  //     Basic would otherwise be down to three, which forces repeat deals at
  //     this group size. ---
  {
    key: 'double',
    name: 'Double Down',
    mark: 'M5 7 L12 14 L19 7 M5 13 L12 20 L19 13',
    description: 'Your points for this question are doubled.',
    flavour: 'Twice the confidence. The same memory.',
    timing: TIMING.ON_SCORE,
  },
  {
    key: 'insurance',
    name: 'Insurance',
    mark: 'M12 4 A8 8 0 1 1 12 20 A8 8 0 1 1 12 4 M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 M12 4 L12 8 M12 16 L12 20 M4 12 L8 12 M16 12 L20 12',
    description: 'Even a completely wrong answer still scores 1 point.',
    flavour: 'Dignity, underwritten.',
    timing: TIMING.ON_SCORE,
    // This deck is only ever dealt during a Power-Up Quiz, which is never a
    // staked round, so the guard in `applyPowerUps` below never actually
    // fires for this card - flagged anyway, for the same reason Safety Net
    // and Nothing to Lose are, in case that ever changes.
    noStakedRounds: true,
  },
  {
    key: 'allornothing',
    name: 'All or Nothing',
    mark: 'M5 5 L19 5 L19 19 L5 19 Z M9 9 L9.01 9 M12 12 L12.01 12 M15 15 L15.01 15',
    description: 'Full marks if {name} likes it, zero if not. No half measures.',
    flavour: 'No middle ground, and no way back.',
    timing: TIMING.ON_SCORE,
  },
  {
    key: 'askher',
    name: 'Ask the Guest of Honour',
    mark: 'M4 6 L20 6 L20 16 L13 16 L9 20 L9 16 L4 16 Z M10.5 10 A2 2 0 0 1 12 12.5 L12 13',
    description: '{name} gives you a one-word hint before you answer.',
    flavour: '{They} {has} been waiting all night to be cryptic.',
    timing: TIMING.ON_PLAY,
    needsHost: true,
    hostPrompt: 'Give them a one-word hint. One word only, be cruel.',
  },

  {
    key: 'warmcold',
    name: 'Warm or Cold',
    mark: 'M12 4 A2 2 0 0 1 14 6 L14 14 A3.5 3.5 0 1 1 10 14 L10 6 A2 2 0 0 1 12 4 M16 8 L19 8 M16 11 L19 11',
    description: 'Before you lock it in, {name} says only "warm" or "cold".',
    flavour: 'Two words. {They} will enjoy choosing.',
    timing: TIMING.ON_PLAY,
    needsHost: true,
    hostPrompt: 'Warm or cold? Say nothing else.',
  },
  // --- Advanced: the ones you aim at somebody else ---
  {
    key: 'steal',
    name: 'Steal',
    mark: 'M4 12 L14 12 M11 9 L14 12 L11 15 M18 5 L18 19',
    // The old wording was "if you are right and THEY are wrong, you take their
    // points" - which describes taking nothing, because a wrong answer has no
    // points on it. Stealing zero was never the intention. The card takes points
    // off somebody who actually scored, and if the person you aimed at has
    // nothing worth taking it is simply spent.
    description: 'If you are both right, you take their points as well as your own.',
    flavour: 'Aim it at somebody who knows the answer.',
    timing: TIMING.ON_SCORE,
    needsTarget: true,
    targetLabel: 'Steal from whom?',
  },
  {
    key: 'shield',
    name: 'Shield',
    mark: 'M12 3 L5 6 L5 12 Q5 18 12 21 Q19 18 19 12 L19 6 Z',
    description: "Immune to everyone else's power-ups this question.",
    flavour: 'Nothing personal. Nothing lands.',
    timing: TIMING.ON_PLAY,
    defensive: true,
  },

  {
    key: 'copycat',
    name: 'Copycat',
    mark: 'M4 8 L14 8 L14 20 L4 20 Z M8 8 L8 4 L20 4 L20 16 L14 16',
    description: "Copy someone's answer exactly and score whatever they score.",
    flavour: 'Their answer. Their fate.',
    timing: TIMING.ON_SCORE,
    needsTarget: true,
    targetLabel: 'Whose answer are you copying?',
  },
  {
    key: 'swap',
    name: 'Swap',
    mark: 'M4 9 L20 9 M17 6 L20 9 L17 12 M20 15 L4 15 M7 12 L4 15 L7 18',
    description: 'Blind-trade answers with a player. Neither of you sees first.',
    flavour: 'Blind on both sides. Fair, technically.',
    timing: TIMING.ON_SCORE,
    needsTarget: true,
    targetLabel: 'Swap answers with whom?',
  },
  {
    key: 'handicap',
    name: 'Handicap',
    mark: 'M6 9 L18 9 L20 20 L4 20 Z M9 9 L9 6 A3 3 0 0 1 15 6 L15 9',
    description: "The current leader's points for this question are halved.",
    flavour: 'Aimed squarely at whoever is winning.',
    timing: TIMING.ON_SCORE,
  },
  // --- Mayhem: the ones that start arguments ---
  {
    key: 'veto',
    name: 'Veto',
    mark: 'M12 3 A9 9 0 1 1 12 21 A9 9 0 1 1 12 3 M6 6 L18 18',
    description: 'One player sits this question out and scores nothing.',
    flavour: 'The meanest card in the deck. You knew that.',
    timing: TIMING.ON_PLAY,
    needsTarget: true,
    targetLabel: 'Who sits this one out?',
  },
  {
    key: 'wildcard',
    name: 'Wildcard',
    mark: 'M6 3 L18 3 L18 21 L6 21 Z M12 8 L13.2 11.2 L16.5 11.5 L14 13.8 L14.8 17 L12 15.2 L9.2 17 L10 13.8 L7.5 11.5 L10.8 11.2 Z',
    description: '{name} awards you 0 to 5 points, entirely on vibes. No rules.',
    flavour: 'No rules at all. Only vibes.',
    timing: TIMING.ON_SCORE,
    needsHost: true,
    hostPrompt: 'Award them anything from 0 to 5. No justification required.',
    // Decide out loud, then tap the matching number on the reveal screen.
    payout: true,
    payoutOptions: [0, 1, 2, 3, 4, 5].map((points) => ({ label: String(points), points })),
  },
]

// ---------------------------------------------------------------------------
// DECK B - loser support
// Given to whoever came last in a category, spent in the next one. Tiered the
// same way, so one setting at setup controls both decks.
//
// The balance rule these follow: help someone catch up without ever making
// losing the smart play. Nothing here is worth deliberately coming last for.
// ---------------------------------------------------------------------------

export const LOSER_SUPPORT = [
  // --- Basic ---
  {
    key: 'headstart',
    name: 'Head Start',
    mark: 'M6 21 L6 4 L18 7 L6 10',
    description: 'You begin the next round 2 points up.',
    flavour: 'A running start, and no explanation offered.',
    timing: TIMING.ON_PLAY,
    instant: true,
    bonusPoints: 2,
  },
  {
    key: 'safetynet',
    name: 'Safety Net',
    mark: 'M4 8 L20 8 M4 8 L8 20 M20 8 L16 20 M8 20 L16 20 M7 14 L17 14 M12 8 L12 20',
    description: 'Your worst answer next round is bumped up to 1 point.',
    flavour: 'Your worst effort, quietly upgraded.',
    timing: TIMING.ON_SCORE,
    // A staked round (the Auction, the Wager Final) has no concept of "1
    // point" - you win your whole stake or lose it, decided purely by whether
    // your points are above zero. Bumping a zero to a one would silently turn
    // "small consolation" into "guaranteed win of everything you bet", which
    // is not what this card is for. Never handed out for a round like that -
    // see `dealOne` and `App.grantLoserSupport`.
    noStakedRounds: true,
  },
  {
    key: 'freeswing',
    name: 'Free Swing',
    mark: 'M12 20 L12 5 M7 10 L12 5 L17 10 M5 20 L19 20',
    description: 'One question next round is worth double, for you only.',
    flavour: 'One question worth twice as much, to you alone.',
    timing: TIMING.ON_SCORE,
    // A staked round pays out win-or-lose-your-stake, not points times a
    // multiplier - doubling a positive number is still a positive number, so
    // this card would be spent for literally nothing there. Never handed out
    // for one.
    noStakedRounds: true,
  },
  {
    key: 'hint',
    name: 'Hint Token',
    mark: 'M14 6 A4 4 0 1 1 14 14 A4 4 0 1 1 14 6 M11 10 L3 10 M5 10 L5 13 M8 10 L8 13',
    description: 'Ask {name} for a hint on any one question.',
    flavour: '{Name} decides how generous to be.',
    timing: TIMING.ON_PLAY,
    needsHost: true,
    hostPrompt: 'Give them a hint. Be as generous as you feel like being.',
  },

  {
    // Replaces Second Wind, which needed a way to reopen an already-scored
    // question - a mechanism that touches the state machine, for one card.
    // This does the same job the card was FOR (rescuing someone who is
    // behind) with only a scoring rule, no reopening anything.
    key: 'nothingtolose',
    name: 'Nothing to Lose',
    mark: 'M4 12 A8 8 0 1 1 8 19 M4 12 L4 7 M4 12 L9 12',
    description: 'Full marks for this question are doubled. A wrong answer still scores 1.',
    flavour: 'You are behind. Swing.',
    timing: TIMING.ON_SCORE,
    // Same reason as Safety Net: the "wrong answer still scores 1" half of
    // this card would flip a lost bet into a won one in a staked round, which
    // is a far bigger effect than the card text describes.
    noStakedRounds: true,
  },
  // --- Advanced. This deck is short enough that Mayhem adds nothing further
  //     to it; the extra Mayhem cards live in the deck above. ---
  {
    key: 'pointthief',
    name: 'Point Thief',
    mark: 'M12 3 L12 14 A4 4 0 1 1 8 14 M9 6 L12 3 L15 6',
    description: 'Take 1 point from anyone you choose.',
    flavour: 'One point. Somebody will notice.',
    timing: TIMING.ON_PLAY,
    needsTarget: true,
    instant: true,
    targetLabel: 'Take a point from whom?',
  },
  {
    // Replaces Choose the Round, which was never going to be fun - the round
    // gets played either way, only the order changes, and reordering rounds
    // means building it into the state machine for a card nobody would miss.
    // This creates an out-loud moment instead: the whole room watching whether
    // the leader nails the question, because two people's scores ride on it.
    key: 'coattails',
    name: 'Coattails',
    mark: 'M12 4 L12 21 M12 6 L20 6 L18 9 L12 9 M12 12 L4 12 L6 15 L12 15',
    description: 'You score whatever the current leader scores on this question.',
    flavour: 'Their answer is your answer now. Hope they know it.',
    timing: TIMING.ON_SCORE,
  },
  {
    key: 'bonusquestion',
    name: 'Bonus Question',
    mark: 'M5 4 L19 4 L19 20 L5 20 Z M10 9.5 A2.5 2.5 0 0 1 14 11.5 Q14 13.2 12 13.8 L12 15 M12 17.5 L12.01 17.5',
    description: 'A private extra question, just for you, worth 2 points.',
    flavour: 'A question nobody else has to answer.',
    timing: TIMING.ON_PLAY,
    needsHost: true,
    hostPrompt: 'Ask them one extra question nobody else gets.',
    payout: true,
    payoutOptions: [
      { label: 'They got it', points: 2 },
      { label: "They didn't", points: 0 },
    ],
  },
  {
    // Rewritten from a "say it out loud" card into a real mechanic. It used to
    // rely on the judge silently marking that player's answer as zero, with
    // nothing on screen explaining why - so the app now works out who is
    // leading and enforces the sit-out itself. See `autoTargetsLeader` and
    // App.jsx's `playPowerUp`.
    key: 'levelling',
    name: 'Levelling',
    mark: 'M12 4 L12 20 M6 20 L18 20 M4 8 L20 8 M4 8 L2 13 A3 3 0 0 0 6 13 Z M20 8 L18 13 A3 3 0 0 0 22 13 Z',
    description: 'The current leader sits out this question. Chosen automatically, not by you.',
    flavour: 'Democratic, and not up for debate.',
    timing: TIMING.ON_PLAY,
    autoTargetsLeader: true,
  },
  {
    key: 'confidence',
    name: 'Vote of Confidence',
    mark: 'M6 21 L6 11 L9 11 L9 21 Z M9 12 L12 5 A2 2 0 0 1 15 7 L14 11 L19 11 A2 2 0 0 1 20 14 L18.5 20 A2 2 0 0 1 16.5 21 L9 21',
    description: 'The room votes. If most of them back you, take 3 points.',
    flavour: 'Put it to the room and find out.',
    timing: TIMING.ON_PLAY,
    needsHost: true,
    hostPrompt: 'Put it to the room. Most hands up means 3 points.',
    payout: true,
    payoutOptions: [
      { label: 'The room backed them', points: 3 },
      { label: "They didn't", points: 0 },
    ],
  },
]

// ---------------------------------------------------------------------------
// LOOKING CARDS UP
// ---------------------------------------------------------------------------

// Falls back to Basic rather than to a tier that no longer exists. There used
// to be an "off" tier and this line still named it, which would have thrown on
// an unrecognised value instead of quietly playing the smallest deck.
export function deckForTier(deck, tier) {
  const size = (TIERS[tier] || TIERS.basic).size
  return deck.slice(0, size)
}

export function findCard(key) {
  return POWER_UPS.find((c) => c.key === key) || LOSER_SUPPORT.find((c) => c.key === key) || null
}

// ---------------------------------------------------------------------------
// HOW A CARD LOOKS
//
// A card's tier is its position in the deck - the first five are Basic, the
// next five Advanced, the rest Mayhem - so it is worked out rather than stored,
// and reordering a deck can never leave a card labelled with the wrong tier.
//
// The band's TEXT COLOUR is carried here rather than inherited. Ink on shiraz
// fails contrast badly, so the Mayhem band has to say for itself that it wants
// cream.
// ---------------------------------------------------------------------------
export const TIER_LOOK = {
  basic: { label: 'Basic', numeral: 'I', band: 'bg-board', text: 'text-ivory' },
  advanced: { label: 'Advanced', numeral: 'II', band: 'bg-red', text: 'text-ivory' },
  mayhem: { label: 'Mayhem', numeral: 'III', band: 'bg-red', text: 'text-panel' },
}

export function tierOfCard(key) {
  const inDeck = (deck) => deck.findIndex((card) => card.key === key)

  const index = inDeck(POWER_UPS) >= 0 ? inDeck(POWER_UPS) : inDeck(LOSER_SUPPORT)
  if (index < 0) return TIER_LOOK.basic
  if (index < TIERS.basic.size) return TIER_LOOK.basic
  if (index < TIERS.advanced.size) return TIER_LOOK.advanced
  return TIER_LOOK.mayhem
}

// ---------------------------------------------------------------------------
// DEALING
//
// One card each, drawn at random without duplicates. If there are more players
// than cards, the deck is reshuffled and topped up - so a repeat only ever
// happens when the maths leaves no choice (Basic tier with a big group).
// ---------------------------------------------------------------------------

// `avoidByPlayer` maps a player id to the card they are holding right now.
// A Power-Up Quiz deals a fresh hand for EVERY question, so without this a
// player could be handed Ask the Guest of Honour three questions in a row and
// the round would stop feeling like it was going anywhere. It is a preference,
// not a guarantee: with a two-card deck and three players somebody has to get
// a repeat, and a repeat is better than no card.
export function dealCards(deck, tier, playerIds, avoidByPlayer = {}) {
  const available = deckForTier(deck, tier)
  if (available.length === 0 || playerIds.length === 0) return []

  let bag = shuffle(available)
  const dealt = []

  playerIds.forEach((playerId) => {
    if (bag.length === 0) bag = shuffle(available) // ran out, start a fresh deck

    const avoid = avoidByPlayer[playerId]
    // Look for something they are not already holding. Only worth trying when
    // the deck has more than one card in it, or this searches for nothing.
    let index = bag.length - 1
    if (avoid && available.length > 1) {
      for (let i = bag.length - 1; i >= 0; i--) {
        if (bag[i].key !== avoid) {
          index = i
          break
        }
      }
    }

    dealt.push({ playerId, key: bag[index].key })
    bag.splice(index, 1)
  })

  return dealt
}

// Draws a single card, used for loser support. `excludeStakedIncompatible`
// keeps a card that would be a guaranteed win or a dead draw in a staked
// round (see `noStakedRounds` above) out of the pool entirely when the round
// it is about to be handed out for is one - better than dealing it and
// relying on the scoring guard to quietly neuter it, because a player should
// never be handed a card that cannot do what its own text says.
export function dealOne(deck, tier, { excludeStakedIncompatible = false } = {}) {
  let available = deckForTier(deck, tier)
  if (excludeStakedIncompatible) available = available.filter((c) => !c.noStakedRounds)
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)].key
}

// ---------------------------------------------------------------------------
// APPLYING EFFECTS AT SCORING TIME
//
// Takes the points the guest of honour actually awarded and bends them
// according to
// whatever cards were played. Kept as one pure function so the whole system is
// readable in one place, and so it can be reasoned about without a database.
//
// THE ORDER CARDS RESOLVE IN, AND WHY IT IS FIXED.
//
// This used to walk `playedCards` in the order they were tapped, with every
// card reading and writing the same running figures. The second audit proved
// what that meant: the SAME four cards, on the same answers, with the same
// verdicts, gave different scores depending on which phone was tapped first.
// Insurance played after a Veto beat it (the player scored 1); played before
// it, it lost (0). Copycat copied its target's points as they stood at that
// instant - before their Double Down (2) or after it (4). Every device agreed
// with every other device, so no two screens ever disagreed; it was simply a
// rule nobody had chosen, and one nobody in the room could see or play around.
//
// So the cards now resolve in FOUR FIXED PHASES, regardless of tap order:
//
//   1. YOUR OWN POINTS      doubling, all-or-nothing, and the 1-point floors.
//                           Everything that only bends what you scored.
//   2. THE LEADER PENALTY   Handicap halves whoever is ahead - after they have
//                           had their own doubling, which is the natural
//                           reading of "their points for this question".
//   3. SITTING OUT          Veto and Levelling zero their target. These land
//                           AFTER the floors, so "scores nothing" is absolute
//                           and beats Insurance - and BEFORE the copying, so
//                           anyone who copied a vetoed player inherits the zero
//                           rather than a figure that no longer exists.
//   4. COPYING AND TAKING   Copycat, Coattails, Steal and Swap. Last, so they
//                           always move the target's FINAL score, which is what
//                           all four cards say they do.
//
// Within one phase, two cards still resolve in the order they were played
// (`played_at`, then `created_at`, then id - see `db.loadFullGame`), which is
// stable on every device. That only matters for genuinely ambiguous pile-ups,
// like two people stealing from the same person, where first-come is as good a
// rule as any.
// ---------------------------------------------------------------------------

// Which phase each card resolves in. Anything not listed here does not touch
// the maths at all (the cards that need the guest of honour to say something
// out loud, or that only change what a player sees).
const PHASES = [
  ['double', 'freeswing', 'insurance', 'safetynet', 'nothingtolose', 'allornothing'],
  ['handicap'],
  ['veto', 'levelling'],
  ['copycat', 'coattails', 'steal', 'swap'],
]

export function applyPowerUps({
  playedCards,
  pointsByAnswerId,
  answersById,
  maxPoints,
  leaderId,
  hasWager = false,
}) {
  const result = { ...pointsByAnswerId }

  // Shielded players ignore anything aimed at them. Every card that names
  // somebody else checks this - including Copycat and Coattails, which take
  // nothing from you but are still somebody else's power-up landing on you.
  // Shield's own text is absolute ("Nothing lands"), and it is now true.
  const shielded = new Set(
    playedCards.filter((c) => c.key === 'shield').map((c) => c.playerId),
  )

  const answerFor = (playerId) =>
    Object.values(answersById).find((a) => a.playerId === playerId)

  // Handicap can only ever double-apply if the same card was somehow dealt to
  // two different players in one round (only possible when the player count
  // exceeds the tier's deck size and it has to reshuffle mid-deal) and both
  // played it on the same question. Halving the leader twice was never the
  // intent - the card says "halved", not "halved again for every copy of
  // itself in play" - so it can fire at most once per question.
  let handicapAlreadyApplied = false

  // The played cards, regrouped into the four phases above. Cards keep their
  // relative play order inside a phase, and anything with no scoring rule is
  // dropped here rather than falling through a `switch` that ignores it.
  const inOrder = PHASES.flatMap((keys) => playedCards.filter((c) => keys.includes(c.key)))

  inOrder.forEach((card) => {
    // A card aimed at its own player is ignored outright. The pickers never
    // offer you your own name, so this cannot happen by tapping - but the two
    // rules that were moved out of the buttons and into the scoring on
    // 1 September were exactly this shape, and Steal aimed at yourself wiped
    // out your own points rather than doing nothing.
    if (card.targetPlayerId && card.targetPlayerId === card.playerId) return

    // NOT computed as a blanket guard any more. It used to be: no answer from
    // the card's own player, skip the whole card - which is right for a card
    // that reads or writes ITS OWN player's points, but Handicap, Veto and
    // Levelling all act on somebody ELSE entirely and never touch `own` at
    // all. A player who played Veto and then never got round to submitting
    // their own answer (easy to do - the hand and the answer box sit on the
    // same screen at the same time) still meant it to land on their target.
    // Under the old blanket guard it silently did not, with nothing on
    // screen explaining why the card had no effect - exactly the kind of
    // dead-card failure the first audit spent a whole pass eliminating. Each
    // case below now checks for `own` only if it actually needs it.
    const own = answerFor(card.playerId)
    const current = own ? result[own.id] || 0 : 0

    switch (card.key) {
      case 'double':
        if (!own) break
        result[own.id] = current * 2
        break

      case 'freeswing':
        if (!own) break
        // A staked round pays out win-or-lose-your-whole-stake, not points
        // times a multiplier, so doubling would do nothing there - `dealOne`
        // and `grantLoserSupport` already avoid handing this out for one, but
        // this guard keeps the maths honest regardless of how the card ended
        // up in play.
        if (!hasWager) result[own.id] = current * 2
        break

      case 'insurance':
      case 'safetynet':
        if (!own) break
        // In a staked round "still scores 1 point" isn't a small consolation
        // - `pointsToScore` only checks whether points are above zero to
        // decide the whole stake, so a floor to 1 would silently turn a lost
        // bet into a guaranteed win. `dealOne`/`grantLoserSupport` already
        // avoid dealing Safety Net into one; this is the belt to that braces.
        if (current === 0 && !hasWager) result[own.id] = 1
        break

      // Doubles like Double Down, but also guarantees the 1-point floor that
      // Insurance does - the two effects that mattered for Second Wind's
      // original job (rescue someone who is behind), combined into one card.
      // Same staked-round guard as Safety Net and Free Swing, for the same
      // reason: the floor becomes a guaranteed win, and the double does
      // nothing.
      case 'nothingtolose':
        if (!own || hasWager) break
        result[own.id] = current === 0 ? 1 : current * 2
        break

      case 'allornothing':
        if (!own) break
        result[own.id] = current > 0 ? maxPoints : 0
        break

      case 'steal': {
        if (!own) break
        const victim = answerFor(card.targetPlayerId)
        if (!victim || shielded.has(card.targetPlayerId)) break
        const theirs = result[victim.id] || 0
        // You have to be right yourself, and they have to have something worth
        // taking. Aimed at somebody who scored nothing, the card is spent for
        // nothing - stealing zero points is not a move, it is a no-op wearing
        // one, and the card text says as much.
        if (current > 0 && theirs > 0) {
          result[own.id] = current + theirs
          result[victim.id] = 0
        }
        break
      }

      case 'copycat': {
        if (!own) break
        // Shield stops this too. Copying takes nothing off the person you aim
        // at, so this was left through originally - but Shield's text is "you
        // are immune to everyone else's power-ups, nothing lands", and Snehin's
        // call was to let it be strictly better rather than reword it.
        if (shielded.has(card.targetPlayerId)) break
        const source = answerFor(card.targetPlayerId)
        if (source) result[own.id] = result[source.id] || 0
        break
      }

      case 'swap': {
        if (!own) break
        const other = answerFor(card.targetPlayerId)
        if (!other || shielded.has(card.targetPlayerId)) break
        const mine = result[own.id] || 0
        result[own.id] = result[other.id] || 0
        result[other.id] = mine
        break
      }

      // Doesn't touch `own` at all - it acts on whoever is leading, who may
      // well not be the player who played the card.
      case 'handicap': {
        if (handicapAlreadyApplied) break
        const leader = answerFor(leaderId)
        if (leader && !shielded.has(leaderId)) {
          result[leader.id] = Math.floor((result[leader.id] || 0) / 2)
          handicapAlreadyApplied = true
        }
        break
      }

      // You score whatever the current leader scores, for better or worse -
      // if the leader hasn't answered (or is you), there is nothing to copy
      // and the card is spent for nothing, same as Copycat aimed at silence.
      // A shielded leader cannot be ridden either, for the same reason Copycat
      // now checks: nothing lands on somebody holding a Shield.
      case 'coattails': {
        if (!own || leaderId === card.playerId) break
        if (shielded.has(leaderId)) break
        const leader = answerFor(leaderId)
        if (leader) result[own.id] = result[leader.id] || 0
        break
      }

      // Doesn't touch `own` either - the whole point is that it lands on
      // somebody else, regardless of whether the player who played it has
      // answered this question themselves.
      case 'veto': {
        const victim = answerFor(card.targetPlayerId)
        if (victim && !shielded.has(card.targetPlayerId)) result[victim.id] = 0
        break
      }

      // The target was worked out automatically when the card was played (see
      // App.jsx's playPowerUp), not chosen by anyone. This case only matters if
      // they had already submitted before the sit-out landed on their screen -
      // the normal path is that they never get an answer box at all, so there
      // is nothing here to zero. Also doesn't touch `own`.
      case 'levelling': {
        const victim = answerFor(card.targetPlayerId)
        if (victim && !shielded.has(card.targetPlayerId)) result[victim.id] = 0
        break
      }

      default:
        // Cards that need the guest of honour to do something, or that only
        // change what a
        // player sees, do not touch the maths.
        break
    }
  })

  // Nothing goes below zero.
  Object.keys(result).forEach((id) => {
    if (result[id] < 0) result[id] = 0
  })

  return result
}
