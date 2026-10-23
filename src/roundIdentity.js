// ---------------------------------------------------------------------------
// ROUND IDENTITY - the decorative half of a round.
//
// Kept apart from roundTypes.js on purpose. That file is the RULES: what the
// player does, how the judging works, how points are worked out. This file is
// what it LOOKS like: a patron, a drawn mark, a band colour, a call to action
// and the deadpan one-liner at the foot of the screen.
//
// Splitting them means changing a joke can never change a scoring rule.
//
// The patron is flavour and never a control. Every one of them is somebody
// who would be standing in a precinct corridor at 2am, played straight.
// ---------------------------------------------------------------------------

// Every mark is a 24x24 path drawn with a 2px ink stroke and no fill. No icon
// library, no image files, and no emoji anywhere in the redesign.
export const ROUND_IDENTITY = {
  typed: {
    patron: 'The Desk Sergeant',
    band: 'accent',
    cta: 'Submit your answer',
    oneLiner: 'Spelling is not scored · Confidence is',
    mark: 'M4 20 L4 6 L14 6 L20 12 L20 20 Z M14 6 L14 12 L20 12 M8 16 L16 16',
  },
  number: {
    patron: 'The Bookmaker, Back Room',
    band: 'page',
    cta: 'Lock in your number',
    oneLiner: '{They} {is} also guessing · {They} would deny this',
    mark: 'M12 3 A9 9 0 1 1 12 21 A9 9 0 1 1 12 3 M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 M12 11.5 L12 12.5',
  },
  rank: {
    patron: 'The Filing Clerk',
    band: 'surface',
    cta: 'Submit your order',
    oneLiner: 'Stand them in a row · {Name} makes the identification',
    mark: 'M4 6 L14 6 M4 12 L11 12 M4 18 L8 18 M18 4 L18 20 M15 17 L18 20 L21 17',
  },
  pitch: {
    patron: 'The Press Agent',
    band: 'accent',
    cta: 'Make your pitch',
    oneLiner: 'Flattery is admissible · It usually works',
    mark: 'M4 10 L4 14 L8 14 L14 19 L14 5 L8 10 Z M17 9 A4 4 0 0 1 17 15',
  },
  fib: {
    patron: 'The Usual Suspect',
    band: 'surface',
    cta: 'Tell your lie',
    oneLiner: 'Lying is encouraged for exactly one round',
    mark: 'M4 8 A4 3 0 0 1 11 8 A4 3 0 0 1 4 8 M13 8 A4 3 0 0 1 20 8 A4 3 0 0 1 13 8 M6 14 Q12 19 18 14',
  },
  auction: {
    patron: 'The Bagman',
    band: 'page',
    cta: 'Place your bid',
    oneLiner: 'There is no refund and no sympathy',
    mark: 'M5 19 L13 19 M6 15 L14 7 M4 9 L10 3 M7 6 L13 12 M15 9 L21 15 M18 12 L21 9',
  },
  powerup: {
    patron: 'The Fixer',
    band: 'accent',
    cta: 'Answer with what you have',
    oneLiner: 'Everyone has an angle · Yours is in your hand',
    mark: 'M13 3 L5 13 L11 13 L10 21 L19 10 L13 10 Z',
  },
  wager: {
    patron: 'The House, Which Always Wins',
    band: 'surface',
    cta: 'Confirm your wager',
    oneLiner: 'The house is not blind · You are',
    mark: 'M5 5 L19 5 L19 19 L5 19 Z M9 9 L9.01 9 M15 9 L15.01 9 M12 12 L12.01 12 M9 15 L9.01 15 M15 15 L15.01 15',
  },
}

// Falls back to the scribe rather than crashing, because a missing identity
// must never blank a screen mid-party.
export function identityFor(type) {
  return ROUND_IDENTITY[type] || ROUND_IDENTITY.typed
}

// ---------------------------------------------------------------------------
// THE WITNESS ALIASES - used to hide who wrote what while the judging happens.
//
// The host sees a mark and an alias, never a player name. The mapping is
// reshuffled EVERY round and derived independently of anything shown in the
// lobby, because a stable pairing gets learned once and then read all night,
// which defeats the entire point of hiding names.
//
// These used to be a mixed pantheon of gods - Athena, Anubis, Susanoo - carried
// over from the app this one was copied from, where the design was built around
// it. Here it was the loudest thing on the judging screen and belonged to
// nothing: a case board does not take statements from Freyja. They are now the
// people who actually turn up in a case file and would rather not give their
// real names. The marks are unchanged; they were always abstract.
// ---------------------------------------------------------------------------
export const ALIASES = [
  { key: 'landlady', name: 'The Landlady', mark: 'M12 3 L5 8 L5 14 L12 21 L19 14 L19 8 Z M9 11 L15 11' },
  { key: 'nightporter', name: 'The Night Porter', mark: 'M6 4 L9 10 L15 10 L18 4 M6 10 L6 17 L12 21 L18 17 L18 10' },
  { key: 'torchsinger', name: 'The Torch Singer', mark: 'M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z' },
  { key: 'stoolie', name: 'The Stoolie', mark: 'M12 3 L12 21 M6 7 L18 7 M7 12 L17 12 M9 17 L15 17' },
  { key: 'nightshift', name: 'The Night Shift', mark: 'M12 5 A7 7 0 1 1 12 19 A7 7 0 1 1 12 5 M12 1 L12 3 M12 21 L12 23 M3 12 L1 12 M23 12 L21 12' },
  { key: 'fence', name: 'The Fence', mark: 'M8 4 A8 8 0 0 0 8 20 M16 4 A8 8 0 0 1 16 20 M12 8 L12 16' },
  { key: 'bartender', name: 'The Bartender', mark: 'M4 8 L20 8 M6 12 L18 12 M8 16 L16 16 M12 4 L12 20' },
  { key: 'undertaker', name: 'The Undertaker', mark: 'M4 10 Q12 2 20 10 M7 13 Q12 9 17 13 M12 15 L12 20' },
]

// A fresh mark-to-player mapping. Seeded by the round so it is stable while
// that round is being judged, and different in the next one.
export function assignAliases(playerIds, seed) {
  const pool = [...ALIASES]

  // A tiny deterministic shuffle: same seed, same order, on every device.
  //
  // The arithmetic goes through Math.imul on purpose. The obvious version of
  // this - `hash = (hash * 1103515245 + 12345) % 2147483648` - overflows
  // JavaScript's 53-bit integer precision on its second step and starts
  // silently dropping the low bits, which collapses eight aliases onto a
  // handful of repeated orders. Math.imul is exact 32-bit multiplication, so every seed
  // gets its own shuffle. This mapping is the only thing hiding who wrote what,
  // so it has to actually be different each round rather than nearly different.
  let hash = 2166136261
  const text = String(seed || '')
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  function nextRandom() {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    hash ^= hash >>> 16
    return hash >>> 0
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = nextRandom() % (i + 1)
    const swap = pool[i]
    pool[i] = pool[j]
    pool[j] = swap
  }

  const mapping = {}
  playerIds.forEach((playerId, index) => {
    mapping[playerId] = pool[index % pool.length]
  })
  return mapping
}

// Ledgers are numbered in roman on the setup bill, so they are numbered in roman
// everywhere else too. Lives here rather than in the band component because a
// component file that also exports a helper breaks fast refresh.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function ledgerNumeral(index) {
  return ROMAN[index] || String(index + 1)
}
