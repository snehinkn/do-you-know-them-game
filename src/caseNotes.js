// ---------------------------------------------------------------------------
// THE CASE BOARD
//
// The four pinned notes on the landing screen, strung together with red thread.
//
// WHY THIS FILE EXISTS AT ALL
//
// The design draws four notes carrying real observations about one particular
// person - "Reading three books. Same bookmark since April." The app cannot
// know anything like that. It knows a name and a set of pronouns, and on the
// landing screen it usually does not even know those, because nobody has typed
// a case number yet.
//
// So the notes are what the Homeric invocation and the marquee were under the
// old look: FLAVOUR. Comic filler that sets the tone before the game knows
// anything. That is a job this app has always had on its first screen, and
// this is the same job in a new voice.
//
// THE RULES, WHICH ARE THE QUESTION BANK'S RULES
//
// A note is read by people who have never met tonight's guest of honour, at a
// party the app knows nothing about. So, exactly as in `questionBank.js`:
//
//   1. ASSUME NOTHING beyond the fact that this person exists. Not that they
//      drink, work, drive, have children, have a partner, or went anywhere in
//      particular. "Recommends things nobody finishes" is safe. "Their usual
//      bar order" is not.
//
//   2. NO NAME, EVER. A note must read correctly with no name available at
//      all, because on the landing screen there usually is none. That means no
//      `{name}` token in here - unlike the question bank, which always has one.
//
//   3. PREFER NO PRONOUN. Same rule as `subject.js`. Most of these are written
//      as bare observations with no subject at all, which is both safer and
//      funnier - a case note is clipped by nature.
//
//   4. NOTHING THAT DOUBLES AS A PASSWORD-RECOVERY QUESTION. These get read
//      across a room.
//
// A test sweeps the whole pool for 1, 2 and 3.
// ---------------------------------------------------------------------------

// `meta` is the little red slug along the top of a note. It is deliberately
// inconsistent - some notes are exhibits, some are canvass results, some are
// priors - because a real board would not be tidy.
export const CASE_NOTES = [
  { meta: 'Exhibit A', text: 'Claims to be low maintenance. Four people have moved a car tonight.' },
  { meta: 'Exhibit B', text: 'Reading three books. Same bookmark since April.' },
  { meta: 'Canvass · 6 asked', text: 'Six people asked. Six different answers. All six confident.' },
  { meta: 'Exhibit D', text: 'Told one story twice tonight. Different ending. Neither one true.' },
  { meta: 'Prior', text: 'Owns a coat for every kind of weather. Wears the same one.' },
  { meta: 'Statement', text: 'Denies having a favourite. Has a favourite.' },
  { meta: 'Exhibit F', text: 'Three alarms set. Wakes to none of them.' },
  { meta: 'Canvass · 5 asked', text: 'Everyone agrees on the story. Nobody agrees on the year.' },
  { meta: 'Exhibit G', text: 'Answers a question with a better question.' },
  { meta: 'Prior', text: 'Has never lost an argument. Ask anyone who was there.' },
  { meta: 'Exhibit H', text: 'Keeps one drawer that nobody else is allowed to open.' },
  { meta: 'Note for the file', text: 'Late twice. Apologised once. Blamed a train that runs on time.' },
  { meta: 'Exhibit J', text: 'Recommends things constantly. Nobody has finished one of them.' },
  { meta: 'Canvass', text: 'Five people in this room. Five spellings of the same name.' },
  { meta: 'Exhibit K', text: 'Says the trip was fine. It was not fine.' },
  { meta: 'Prior', text: 'Once queued forty minutes for something that was free.' },
  { meta: 'Exhibit M', text: 'Has a system. Will not explain the system.' },
  { meta: 'Statement', text: 'Says {they} {does} not mind either way. Minds enormously.' },
]

// Where the four notes sit on the board, and how far each is knocked off
// square. Fixed rather than random: the red thread behind them is drawn to
// these exact points, so a note that moved would leave the string pointing at
// nothing.
//
// Measured off the design canvas, which draws the board 354 wide by 268 tall.
export const BOARD_SLOTS = [
  { x: 4, y: 6, rot: -1.6 },
  { x: 140, y: 74, rot: 1.4 },
  { x: 0, y: 140, rot: -2.2 },
  { x: 152, y: 196, rot: 1.1 },
]

// Four notes, picked without repeats.
//
// `seed` keeps the choice stable for as long as the caller wants it stable -
// pass a room code and a given game always shows the same board, pass nothing
// and it varies per visit. It must never reshuffle on a re-render, which is
// the whole reason this is a seeded pick rather than a call to Math.random in
// the component.
//
// `maxChars` is for the landing board, where the notes sit in fixed slots with
// fixed gaps under them: a note two lines taller than the design's own would
// run into the piece below it. Filtering the pool is the honest fix - nothing
// is truncated, the long entries are simply not offered to a board that cannot
// hold them. Left off, the whole pool is in play.
export function pickCaseNotes(seed = '', count = BOARD_SLOTS.length, maxChars = Infinity) {
  const pool = CASE_NOTES.filter((note) => note.text.length <= maxChars)
  const chosen = []
  let hash = hashString(String(seed)) || 1

  for (let i = 0; i < count && pool.length > 0; i++) {
    // A plain linear congruential step. Not good randomness, and it does not
    // need to be - it needs to be the SAME every time for the same seed.
    hash = (hash * 1103515245 + 12345) % 2147483648
    const index = Math.abs(hash) % pool.length
    chosen.push(pool[index])
    pool.splice(index, 1)
  }

  return chosen
}

function hashString(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483648
  }
  return hash
}
