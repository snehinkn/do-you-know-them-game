// ---------------------------------------------------------------------------
// FITTING A QUESTION ONTO A PHONE
//
// The design sets questions in Archivo Black at `clamp(28px, 11cqw, 40px)`.
// That is a poster face at poster size, and it is the right look - but the
// prototype only ever showed it short questions. The host can write their own,
// of any length, and a long one at 40px walks off the bottom of the screen.
//
// THE RULE: A QUESTION IS NEVER TRUNCATED AND NEVER SCROLLS. It wraps
// downwards onto as many lines as it needs, and the TYPE SHRINKS so that those
// lines still fit the space the screen has. A question is the one thing on the
// screen that everybody has to be able to read, so it is the last thing that
// should be sacrificed to a layout.
//
// WHY LENGTH AND NOT MEASUREMENT
//
// The obvious alternative is to render it, measure it, and shrink until it
// fits. That means a `ResizeObserver`, a loop, and a visible flash of the wrong
// size on every question - on a screen eight people are looking at, in a room
// where the host has just read the question out. Sizing from the character
// count is decided before the first paint, cannot loop, and can be unit
// tested, which measurement cannot.
//
// It is approximate. It is approximate in the safe direction: the bands are
// set so that the longest question in each band still fits, which means a
// short question in a long band is merely smaller than it strictly had to be.
// Nobody has ever noticed a question being slightly too small. Everybody
// notices one running off the screen.
// ---------------------------------------------------------------------------

// WHERE THESE NUMBERS COME FROM - measured, not guessed.
//
// Archivo Black was measured in the browser with `canvas.measureText`: it
// averages 0.55 x the font size per character. On a 412px phone with 24px of
// padding either side that leaves 364px, so:
//
//     40px -> 16 characters per line     23px -> 28
//     33px -> 20                         20px -> 33
//     28px -> 23
//
// Ragged-right wrapping wastes about a tenth of that, and the budget for a
// question block is roughly 210px of height. Multiply it out and each band's
// cut-off is the longest question that still fits in about six lines.
//
// Line-height opens up as the type shrinks. 0.98 is a poster setting - lovely
// on two big lines, unreadable on eight small ones, because the descenders of
// one line start touching the capitals of the next.
//
// FOR CONTEXT ON HOW MUCH THIS ACTUALLY FIRES: the 303 written questions run
// from 29 to 93 characters, median 54. Nine in ten of them land in the top
// band and get the full poster treatment, which is the design's intent. The
// lower bands exist almost entirely for questions the host writes themselves.
const BANDS = [
  { upTo: 72, size: 'clamp(28px, 11cqw, 40px)', lineHeight: 0.98 },
  { upTo: 108, size: 'clamp(24px, 9.2cqw, 33px)', lineHeight: 1.02 },
  { upTo: 130, size: 'clamp(21px, 7.8cqw, 28px)', lineHeight: 1.08 },
  { upTo: 200, size: 'clamp(19px, 6.6cqw, 23px)', lineHeight: 1.14 },
  // The floor. Still comfortably above the design's own rule that nothing
  // below 13px may carry meaning you have to read in order to play.
  { upTo: Infinity, size: 'clamp(17px, 5.6cqw, 20px)', lineHeight: 1.2 },
]

// The smallest type this will ever produce, so a test can assert the floor
// without knowing how the bands are built.
export const SMALLEST_QUESTION_PX = 17

export function questionFit(text) {
  const length = typeof text === 'string' ? text.trim().length : 0
  const band = BANDS.find((candidate) => length <= candidate.upTo) || BANDS[BANDS.length - 1]

  return {
    fontSize: band.size,
    lineHeight: band.lineHeight,
    // Archivo Black has no hyphenation to fall back on, so a single
    // unbroken run of characters - a URL somebody pasted into a host-written
    // question, or a very long word - would push the line wider than the
    // phone and take the whole layout sideways with it. Breaking mid-word is
    // ugly; a horizontal scrollbar on a party game is worse.
    overflowWrap: 'anywhere',
  }
}

// How many bands there are, for tests that want to walk all of them.
export const QUESTION_BANDS = BANDS.length
