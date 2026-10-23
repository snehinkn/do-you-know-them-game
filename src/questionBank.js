// ---------------------------------------------------------------------------
// THE QUESTION BANK - every question that could be asked tonight.
//
// An earlier, much smaller version of this bank was written for one
// particular person before any of it was made general.
//
// WRITTEN ABOUT NOBODY IN PARTICULAR
//
// Every question here refers to the guest of honour as `{name}`, and to them
// as `{their}` / `{them}`. Those are filled in once, with whatever the host
// typed at setup, at the moment the questions are copied into the database -
// see `fillQuestion` in subject.js. Nothing downstream ever sees a token.
//
// Prefer `{name}` to a pronoun, and never put `{they}` in front of an
// ordinary verb: singular "they" takes the plural form, so "{they} goes" is
// broken for the default pronoun set. Reword instead. A modal is safe -
// "{they} could" reads correctly whichever set is chosen.
//
// HOW A GAME USES THIS
//
// The bank is NOT the game. At setup, each round draws a random handful from
// its own list, and only what was drawn is written to the database - so the
// rows in `questions` are exactly the questions being played, and every screen
// can go on treating "the questions in this category" as "the questions in this
// round". Nothing downstream had to learn about a bank.
//
// Drawing at random means the same set of friends can play twice and get a
// different night, and it means nobody who has seen this file has an advantage.
//
// STANDING RULES for anything added here:
//
//   - Nothing may ASSUME anything about the guest of honour beyond having a
//     name. The bank is played by people the host has never met. Nothing may
//     assume they drink alcohol, have a job, have children, or went to
//     university. "Quiet drinks" as one option in a night-out ranking is fine;
//     "what is their usual bar order" is not. This began as a rule about one
//     person who does not drink (Snehin, 18 August) and generalises exactly.
//   - Nothing ranks people. See the note in ROUNDS.md - auto-matching would
//     publicly rank the guests against each other, at their friend's party.
//   - Nothing that doubles as a password-recovery question (first pet,
//     mother's maiden name). These get read out loud to a room.
//   - Question text must be UNIQUE across the whole bank. Draws exclude what
//     is already in play by matching on text, since a drawn question has no
//     other identity until the database gives it one.
// ---------------------------------------------------------------------------

// What one question in each round is worth. Judged rounds are scored by fixed
// verdict (see VERDICT_POINTS), so this is the ceiling rather than the award;
// the self-scoring rounds work their own points out and ignore it entirely.
const POINTS_BY_TYPE = {
  typed: 2,
  number: 3,
  rank: 0,
  pitch: 3,
  fib: 0,
  auction: 0,
  powerup: 2,
  wager: 3,
}

// How many questions a round starts with. The host can change any of these on
// the setup screen, up to however many that round has in the bank.
//
// These are deliberately small. A round is a category with its own leaderboard
// and its own results screen, and eight rounds of five questions is a three
// hour game nobody asked for. Wager Final is 1 because it is the closer - the
// whole point is that everything rests on one question.
const DEFAULT_COUNT_BY_TYPE = {
  typed: 3,
  number: 3,
  rank: 2,
  pitch: 2,
  fib: 2,
  auction: 2,
  powerup: 3,
  wager: 1,
}

// The rounds, in the order they are played. `included` is what the setup
// screen's Playing/Add toggle switches.
//
// EVERY playable round starts ON (decided by Snehin, 18 August). The Power-Up
// Quiz used to start off, on the grounds that it is the one round needing rules
// explained aloud - but the rules, rounds and power-up cards are being sent
// round beforehand, so nobody meets it cold. The host can still switch off
// anything
// the host does not fancy on the night.
export const CATEGORY_SETUP = [
  { type: 'typed', included: true },
  { type: 'number', included: true },
  { type: 'rank', included: true },
  { type: 'pitch', included: true },
  { type: 'fib', included: true },
  { type: 'auction', included: true },
  { type: 'powerup', included: true },
  { type: 'wager', included: true },
]

// ---------------------------------------------------------------------------
// The eight lists themselves live one per round in src/bank/, because a single
// file holding five thousand questions is a file nobody can find anything in.
// Each exports a plain array in whatever shape reads best for that round - a
// bare string where a round is only a question, an object where there is an
// item list or a bidding topic to carry - and build() below levels them all
// into the same question object.
// ---------------------------------------------------------------------------
import { shuffle } from './shuffle.js'
import TYPED from './bank/typed.js'
import NUMBER from './bank/number.js'
import RANK from './bank/rank.js'
import PITCH from './bank/pitch.js'
import FIB from './bank/fib.js'
import AUCTION from './bank/auction.js'
import POWERUP from './bank/powerup.js'
import WAGER from './bank/wager.js'

// ---------------------------------------------------------------------------
// Turning the lists above into question objects.
// ---------------------------------------------------------------------------

// Every entry is written in whatever shape reads best above - a bare string for
// the rounds that are only a question, an object where there is an item list or
// a topic to carry. They all come out of here the same shape.
function build(type, entries) {
  return entries.map((entry) => {
    const base = typeof entry === 'string' ? { text: entry } : entry
    return { type, points: POINTS_BY_TYPE[type], ...base }
  })
}

export const QUESTION_BANK = {
  typed: build('typed', TYPED),
  number: build('number', NUMBER),
  rank: build('rank', RANK),
  pitch: build('pitch', PITCH),
  fib: build('fib', FIB),
  auction: build('auction', AUCTION),
  powerup: build('powerup', POWERUP),
  wager: build('wager', WAGER),
}

// Everything a round could ask. Never mutated - draws copy out of it.
export function bankFor(type) {
  return QUESTION_BANK[type] || []
}

// How many questions the bank actually holds for a round. This is the size of
// the pool a draw comes out of, NOT what a host may set a round to - see
// MAX_QUESTIONS_PER_ROUND below. The two used to be the same number, back when
// the shortest round had nine questions written for it.
export function bankSizeFor(type) {
  return bankFor(type).length
}

// The ceiling on a single round, whatever the bank holds.
//
// Every round now has hundreds of questions behind it, and "the most a round
// can be set to" is no longer a fact about the bank - it is a decision about
// how long a night should run. Fifteen questions in one round is already a
// long round; the bank being deep is about never repeating a night, not about
// playing a hundred questions of The Canvass (Snehin, 4 September).
export const MAX_QUESTIONS_PER_ROUND = 15

// The most questions a round can be set to on the setup screen: the ceiling,
// or the whole bank if a round somehow has fewer than that written.
export function maxQuestionsFor(type) {
  return Math.min(bankSizeFor(type), MAX_QUESTIONS_PER_ROUND)
}

// What a question of this type is worth, for a host writing one of their own
// rather than drawing from the bank. Same table `build()` already uses, so a
// host-written question scores exactly like a bank one of the same type.
export function pointsFor(type) {
  return POINTS_BY_TYPE[type] ?? 0
}

export function defaultCountFor(type) {
  const wanted = DEFAULT_COUNT_BY_TYPE[type]
  const max = maxQuestionsFor(type)
  // A round with a short bank gets whatever it has rather than a default it
  // cannot honour.
  if (wanted === undefined) return max
  return Math.min(wanted, max)
}

// Draw `count` questions at random from a round's bank, skipping any whose text
// is already in `excludeTexts`.
//
// Excluding by text is what makes "add one more question" work without
// redrawing the round: the questions already chosen stay exactly as they are,
// and the new one comes from what is left. Text is the only identity a question
// has before the database gives it a real one, which is why every question in
// this file has to be worded differently from every other.
export function drawQuestions(type, count, excludeTexts = []) {
  const taken = new Set(excludeTexts)
  const pool = bankFor(type).filter((question) => !taken.has(question.text))

  // Shuffle-then-slice rather than picking `count` times, so the same question
  // can never be drawn twice. The bank itself is never reordered - `shuffle`
  // works over a copy - since that would quietly change what every later
  // call sees.
  return shuffle(pool).slice(0, Math.max(0, count))
}
