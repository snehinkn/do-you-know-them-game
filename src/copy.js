// ---------------------------------------------------------------------------
// COPY POOLS - the lines that vary.
//
// These come from the design bundle, which lists them as pools and asks for
// them to live as data rather than being hardcoded into a component. Keeping
// them here means the writing can be changed without opening a screen file, and
// it keeps three lists of jokes out of the middle of the leaderboard layout.
//
// PICKING IS SEEDED, NEVER RANDOM. The app reloads the whole game on every
// realtime message, so `Math.random()` here would reshuffle the winner's line
// every few seconds while everybody is reading it. Seeded by something stable -
// the game id, the question id - it is chosen once and stays chosen.
// ---------------------------------------------------------------------------

// What gets said about whoever won. Never about how they won: the line has to
// be true whatever the scores turned out to be.
export const WINNER_LINES = [
  'Which is either friendship or surveillance.',
  'Years of quiet observation, finally entered into evidence.',
  'The file was thicker than anybody expected.',
  'The handwriting has been checked. It holds.',
  'Every answer checked out, which is the unsettling part.',
  'An unsettling volume of correct information about one person.',
  'Motive, means, opportunity. Mostly opportunity.',
  'Somebody has been taking notes since the very beginning.',
  'Closed the case without once raising {their} voice.',
  'It goes in the record. {name} intends to appeal.',
]

// And about whoever came last. These are deliberately affectionate - the person
// reading this is at their friend's birthday, and the joke is on the situation
// rather than on them.
export const LOSER_LINES = [
  'finished last, and is already drafting an appeal.',
  'came last, and would like it noted the questions were leading.',
  'placed last and is taking it extremely well, apparently.',
  'is last, and maintains nobody ever read {them} {their} rights.',
  'came last. Somebody has to hold the bottom of the file.',
  'finished last and insists the whole thing was a fit-up.',
  'is last, and remains {their} friend regardless. Probably.',
  'came last, with total conviction and no evidence whatsoever.',
  'finished last. That part of the record gets sealed tonight.',
  'is last. The evidence was circumstantial at best.',
]

// Placeholder text in the answer box. It is the only place in the app that
// nudges someone who is sitting there not typing.
export const TYPED_PROMPTS = [
  'Answer plainly. {They} can smell a hedge.',
  'Give a statement. Silence scores nothing.',
  'Anything written here can and will be used.',
  'Say the first thing. It is usually the honest one.',
  'Guesses welcome. Excuses less so.',
  'Put it in writing so it can be held against you.',
  'On the record, in your own words.',
  'The stenographer is waiting.',
  'One answer. No footnotes.',
  'Sign it before you talk yourself out of it.',
]

// Same seed, same line, on every device - which matters, because the host and
// six players are all rendering this from their own browsers and a leaderboard
// that says something different on each phone reads as a bug.
export function pickFrom(list, seed) {
  if (!list || list.length === 0) return ''
  let hash = 0
  const text = String(seed || '')
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 100000
  return list[hash % list.length]
}
