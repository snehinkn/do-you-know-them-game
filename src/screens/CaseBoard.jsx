import { fill, subjectFrom } from '../subject.js'
import { ROUND_TYPES } from '../roundTypes.js'
import { ledgerNumeral } from '../roundIdentity.js'
import { BOARD_H } from '../viewportFit.js'

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE LANDING BOARD. The very first screen, before we know which game you are
// in: a corkboard of pinned evidence with red thread strung across it, DO NOT
// CROSS tape at an angle, the case hero, and the sign-in card pinned on top.
//
// Two doors, exactly as before:
//   Players type their name and the case number the host reads out.
//   The host opens a new case, which sends them to a private host link.
//
// TWO BOARDS, TWO BUNDLES, ONE SET OF PIECES
//
// The design ships this screen as two separate handoffs, and they are NOT the
// same composition at two widths - they are the same evidence read two ways:
//
//   Desktop  `Main Page - Do You Know Them.dc.html`        1492 x 830, no scroll
//   Phone    `Main Page Mobile - Do You Know Them.dc.html`  390 x 2420, scrolls
//
// The phone one is emphatic that it is "a corkboard, not a column": the same
// cards, absolutely positioned, overlapping, tilted, bleeding off the edges -
// "scaled down and made taller instead of re-flowed". So neither board reflows.
// Both are their bundle's own coordinates, scaled to the window.
//
// Every card is ONE component used by both boards, with an `m` flag for the
// handful of numbers the two bundles genuinely differ on (the hero drops
// 62px to 43px, the newspaper drops to a single column, hit targets go 38px to
// 46px). Two copies of a card would drift apart within a session.
//
// HOW EACH BOARD MEETS A REAL WINDOW
//
//   Desktop. Every piece keeps its literal design pixel position and size, and
//   the whole board is scaled by one factor so it fills the window's HEIGHT
//   exactly - it can never be taller than the window, which is the "we have to
//   scroll slightly" complaint this screen arrived with. A laptop is wider in
//   proportion than the design box, and that spare width goes into the gutters
//   BETWEEN the board's three clusters, never into the margins: handing it to
//   the margins would park the board back in the middle of an empty field,
//   which is the one thing bundle 3 exists to stop. Which cluster a piece
//   belongs to is decided by what it is pinned NEXT to, not by which half of
//   the board it sits in.
//
//   Phone. One scale factor on the width, and the 2420px canvas scrolls. That
//   is the design's own model, so nothing has to be adapted at all.
//
//   Between them. Under `COLLAGE_MIN` the desktop board would need a scale
//   that puts its 9px Courier labels under 7px, so the phone board is used
//   instead, capped and centred. That is the shell's own behaviour below its
//   breakpoint, not a centred desktop column sneaking back in.
//
// THE PROBLEM THIS SCREEN HAS, AND HOW IT IS SOLVED
//
// The hero is the guest of honour's name. But this screen runs BEFORE the app
// knows which game anyone is joining, so there is no name to put there. It is
// the one screen in the app that has to work knowing nothing.
//
// So the hero starts on a line that works with nothing - "SOMEONE / YOU KNOW",
// which is the design's own placeholder too - and fills in the real name the
// moment a complete case number is typed. `findGameByRoomCode` already existed
// for this; the lookup is one query, fired only on a full-length code, and a
// failure is silent because a half-typed code is not an error, it is somebody
// still typing.
// ---------------------------------------------------------------------------
// Split out of `StartScreen.jsx`, where all of this used to live inline. That
// file keeps the sign-in form and the data it needs (the room-code lookup,
// the host-resume flow); every component that draws either board lives here
// instead. `StartScreen` imports `CaseBoard`, `CaseBoardMobile`, `Hero`,
// `CardPin` and `Label` back from this file - the last three because its own
// sign-in card is itself one piece of the board and uses them too. The
// window-fitting math the two boards are sized by lives in `viewportFit.js`,
// its own file for the same reason this one holds no plain functions: a file
// mixing components and non-components loses fast refresh.
// ---------------------------------------------------------------------------

// The phone canvas, verbatim from the mobile bundle. This one scrolls.
const MOBILE_W = 390
const MOBILE_H = 2420

// A phone board on a window wider than any phone stops reading as a phone
// board and starts reading as a blown-up one. Past this it is centred instead.
const MOBILE_MAX_SCALE = 1.2

// The three clusters, in the order the spare width is handed out.
const LEFT = 0
const MID = 1
const RIGHT = 2

// A handful of notes carry {they}/{does} tokens, and this screen is the one
// place in the app with no game behind it to fill them from - so it fills them
// from nobody, which is what `subject.js` is built to do. Without this the
// board prints the braces, which reads as a broken app rather than as a joke.
const NOBODY = subjectFrom({})

// The one-word mode against each ledger on the counts panel. The design prints
// one of these beside every count; they describe what a player DOES, which is
// the only thing worth knowing before the night starts.
const LEDGER_MODES = {
  typed: 'typed',
  number: 'closest',
  rank: 'order',
  pitch: 'pitch',
  fib: 'bluff',
  auction: 'bid',
  powerup: 'favours',
  wager: 'all in',
}

const COUNTS = Object.values(ROUND_TYPES)

// ---------------------------------------------------------------------------
// THE PIECES
//
// Each one draws its whole card - paper, padding, tilt, lift, and its own pin
// where the phone board asks for one - and nothing about where it sits. The
// boards place them. `m` switches the handful of values the two bundles
// genuinely disagree on.
// ---------------------------------------------------------------------------

const LIFT_SM = '5px 7px 0 rgba(0,0,0,0.4)'
const LIFT_MD = '7px 9px 0 rgba(0,0,0,0.45)'
const LIFT_LG = '9px 11px 0 rgba(0,0,0,0.5)'

// The phone bundle pins a card by hanging the pin off the card's OWN top edge,
// so it tilts with the paper. The desktop bundle draws its pins as separate
// board-level elements, several of them well off their card's centre, and
// leaves them upright - so that board places its own and passes nothing here.
export function CardPin({ at, tone = 'red' }) {
  if (at == null) return null
  const size = tone === 'bone' ? 14 : 13
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: at + 'px',
        top: '-7px',
        width: size + 'px',
        height: size + 'px',
        background: tone === 'bone' ? 'var(--color-bone)' : 'var(--color-red)',
        boxShadow:
          tone === 'bone' ? '1px 2px 4px rgba(0,0,0,0.7)' : '1px 2px 3px rgba(0,0,0,0.6)',
      }}
      aria-hidden="true"
    />
  )
}

export function Label({ children, className = '', tracking = '0.24em', size = 9, style }) {
  return (
    <div
      className={'font-mono font-bold uppercase ' + className}
      style={{ fontSize: size + 'px', letterSpacing: tracking, ...style }}
    >
      {children}
    </div>
  )
}

// The newspaper clipping. Two justified columns on a laptop; the phone bundle
// drops it to one, because "two columns don't hold at 258px".
function DailyPrecinct({ m = false }) {
  return (
    <div
      className="relative bg-paper-aged text-ink"
      style={{
        padding: '12px 14px 14px',
        transform: 'rotate(' + (m ? -2.6 : -1.2) + 'deg)',
        boxShadow: LIFT_MD,
        borderTop: '4px solid var(--color-red)',
      }}
    >
      <div
        className="flex items-baseline justify-between border-b-2 border-ink pb-1.5 font-mono
                   font-bold uppercase"
        style={{ fontSize: m ? '9px' : '10px', letterSpacing: m ? '0.18em' : '0.24em' }}
      >
        <span>The Daily Precinct</span>
        <span className="text-red-deep" style={{ letterSpacing: '0.1em' }}>
          Late ed.
        </span>
      </div>
      <div
        className="font-impact uppercase"
        style={{ fontSize: m ? '20px' : '19px', lineHeight: 1.04, marginTop: m ? '9px' : '10px' }}
      >
        Local resident remains mystery to all who know them
      </div>
      <div className="h-[2px] bg-red" style={{ marginTop: m ? '8px' : '9px' }} />
      <div
        className={
          'font-mono text-justify text-ink-muted ' +
          (m ? 'flex flex-col gap-[7px]' : 'grid grid-cols-2 gap-2.5')
        }
        style={{ fontSize: '9.5px', lineHeight: m ? 1.55 : 1.5, marginTop: m ? '8px' : '9px' }}
      >
        <p>
          Neighbours report conflicting accounts. Long-term friends admit they have
          never met the family. One source, asked not to be named, said simply: “Who
          even knows.”
        </p>
        <p>
          Investigators have compiled eight separate counts. None of the responding
          detectives claim certainty. The case remains active. No charges filed.
        </p>
      </div>
    </div>
  )
}

// The pinned evidence scraps. `tone` is the design's two variants: a bright red
// top rule on the newest note, a deeper one on the older ones.
function NoteCard({ note, tilt, tone = 'red', paper = 'bg-paper', m = false, pin, pinTone }) {
  const rule = tone === 'red' ? 'var(--color-red)' : 'var(--color-red-deep)'
  return (
    <div
      className={'relative ' + paper + ' text-ink'}
      style={{
        padding: m ? '10px 12px 12px' : '11px 13px 13px',
        transform: 'rotate(' + tilt + 'deg)',
        boxShadow: LIFT_MD,
        borderTop: '4px solid ' + rule,
      }}
    >
      <CardPin at={pin} tone={pinTone} />
      <Label
        className="text-red-deep"
        size={m ? 8.5 : 9}
        tracking={m ? '0.22em' : '0.24em'}
      >
        {note.meta}
      </Label>
      <div
        className="mt-1.5 font-mono"
        style={{ fontSize: (m ? 13 : 14) + 'px', lineHeight: 1.4 }}
      >
        {fill(note.text, NOBODY)}
      </div>
    </div>
  )
}

// The tally. Pure decoration, and the count is the board's own evidence count
// rather than anything from the game - a real board has a number scratched on
// it that only means something to whoever scratched it.
function Tally({ m = false }) {
  return (
    <div
      className="relative bg-paper text-ink"
      style={{
        padding: '8px 12px 10px',
        transform: 'rotate(' + (m ? 1.8 : 0.8) + 'deg)',
        boxShadow: LIFT_SM,
      }}
    >
      <Label className="text-red-deep" size={8.5}>
        Count
      </Label>
      <div className="mt-[5px] flex items-center gap-[9px]">
        <svg
          viewBox="0 0 46 22"
          style={{ width: '46px', height: '22px', flex: '0 0 auto' }}
          aria-hidden="true"
        >
          <g stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round">
            <line x1="3" y1="3" x2="3" y2="19" />
            <line x1="9" y1="3" x2="9" y2="19" />
            <line x1="15" y1="3" x2="15" y2="19" />
            <line x1="21" y1="3" x2="21" y2="19" />
            <line x1="1" y1="18" x2="23" y2="4" stroke="var(--color-red-deep)" />
            <line x1="32" y1="3" x2="32" y2="19" />
            <line x1="38" y1="3" x2="38" y2="19" />
          </g>
        </svg>
        <span className="font-mono whitespace-nowrap" style={{ fontSize: '13px' }}>
          = 7
        </span>
      </div>
    </div>
  )
}

// There is no photo and there never will be - an earlier draft of this design
// had photo slots on the board and they were removed deliberately, so the empty
// frame says so out loud rather than waiting for an upload that is not coming.
function Wanted({ m = false }) {
  return (
    <div
      className="relative bg-paper-aged text-center text-ink"
      style={{
        padding: '10px 12px 12px',
        transform: 'rotate(' + (m ? -3 : -1.8) + 'deg)',
        boxShadow: m ? LIFT_MD : LIFT_MD,
      }}
    >
      <div
        className="font-impact uppercase text-red-deep"
        style={{
          fontSize: '24px',
          letterSpacing: '0.04em',
          borderBottom: '3px solid var(--color-red-deep)',
          paddingBottom: '5px',
        }}
      >
        Wanted
      </div>
      <div
        className="mt-[9px] flex items-center justify-center border-2 border-dashed border-ink-dashed"
        style={{ height: (m ? 82 : 84) + 'px' }}
      >
        <span
          className="font-mono font-bold uppercase text-ink-faint"
          style={{ fontSize: '9.5px', letterSpacing: '0.2em', lineHeight: 1.7 }}
        >
          No photo
          <br />
          on file
        </span>
      </div>
      <div
        className="mt-2 font-mono font-bold uppercase"
        style={{ fontSize: '9.5px', letterSpacing: '0.22em', lineHeight: 1.6 }}
      >
        {m ? (
          'For knowing things'
        ) : (
          <>
            For knowing
            <br />
            things
          </>
        )}
      </div>
    </div>
  )
}

// The only surface in the whole product the yellow is allowed to appear on -
// two of them now, the trip-note flavour line and the practical facts below
// (`Facts`), both dressed as the same scrap of paper. `text` covers the
// simple case; `children` lets a caller with its own line breaks (`Facts`
// needs a `<br/>` between rows, which a plain string can't carry) draw
// inside the same sticky note rather than duplicating its styling.
function Sticky({ text, children, m = false, tilt }) {
  return (
    <div
      className="bg-sticky text-ink"
      style={{
        padding: m ? '10px 12px 12px' : '11px 12px 13px',
        transform: 'rotate(' + (tilt ?? (m ? -4.6 : -3.4)) + 'deg)',
        boxShadow: LIFT_SM,
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: (m ? 12.5 : 13) + 'px', lineHeight: 1.35 }}
      >
        {children ?? fill(text, NOBODY)}
      </div>
    </div>
  )
}

// Charges pending is the real round count, so a change to the game can never
// leave a stale number on the landing page.
function StillAtLarge({ m = false, pin }) {
  return (
    <div
      className="relative bg-red text-bone"
      style={{
        padding: '12px 14px 14px',
        transform: 'rotate(' + (m ? -3.2 : 1) + 'deg)',
        boxShadow: LIFT_MD,
      }}
    >
      <CardPin at={pin} tone="bone" />
      <Label tracking="0.2em">Answers on file: 0</Label>
      <div
        className="mt-[7px] font-impact uppercase"
        style={{ fontSize: '30px', lineHeight: 0.92 }}
      >
        Still at
        <br />
        large
      </div>
      <Label className="mt-2" tracking="0.2em">
        Charges pending: {COUNTS.length}
      </Label>
    </div>
  )
}

// DESKTOP ONLY. Its own fixed-height piece rather than a row inside the
// sign-in card - see the note where the card builds itself for why: a
// button that only shows up when the sign-in card has room to spare kept
// running past the board's edge the moment that card grew for any other
// reason (an error banner, the resume-hosting row). This piece's height
// never depends on anything happening elsewhere on the board, so it has
// nothing to threaten.
function HostPiece({ onCreate, creating }) {
  return (
    <div
      className="relative bg-paper text-ink"
      style={{
        padding: '14px 16px 15px',
        transform: 'rotate(-1.2deg)',
        boxShadow: LIFT_MD,
        borderTop: '6px solid var(--color-red)',
      }}
    >
      <CardPin tone="bone" />
      <Label className="text-red-deep" size={8.5} tracking="0.22em">
        Running it yourself
      </Label>
      <div
        className="mt-[3px] font-impact uppercase"
        style={{ fontSize: '19px', letterSpacing: '-0.02em', lineHeight: 1.05 }}
      >
        Open your own case
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="focus-ring mt-3 flex h-[42px] w-full items-center justify-between border-2
                   border-red bg-transparent px-3.5 font-impact uppercase text-red-deep
                   hover:bg-red hover:text-bone disabled:opacity-50"
        style={{ fontSize: '14px' }}
      >
        {creating ? 'Opening…' : 'Start as host'}
        <span className="font-mono" style={{ fontSize: '14px' }} aria-hidden="true">
          &rarr;
        </span>
      </button>
    </div>
  )
}

// `code` and the CASE OPEN stamp are desktop only. On the phone that pair moves
// into the overlay header, and the bundle says why: an overlap may cover a
// card's padding and rules but never its type, so the hero carries no chip.
export function Hero({ subjectName, nameIsKnown, code, m = false, pin }) {
  return (
    <div
      className="relative bg-paper text-ink"
      style={{
        padding: m ? '15px 18px 14px' : '18px 22px 16px',
        transform: 'rotate(' + (m ? -1.6 : -0.7) + 'deg)',
        boxShadow: LIFT_LG,
        borderTop: '8px solid var(--color-red)',
        containerType: 'inline-size',
      }}
    >
      <CardPin at={pin} tone="bone" />
      <Label className="text-red-deep" size={m ? 9 : 10} tracking="0.28em">
        The case of
      </Label>
      <div
        className="font-impact uppercase"
        style={{
          // The placeholder is three words where a name is usually one, so it
          // drops a size. Both are `cqw` against this card rather than against
          // the window, which is also what carries the bundles' 62px -> 43px
          // by itself: the phone hero is a narrower card, so the same rule
          // lands on the smaller number without a second value to keep in step.
          fontSize: nameIsKnown ? 'clamp(40px, 19cqw, 88px)' : 'clamp(30px, 15.8cqw, 62px)',
          lineHeight: 0.86,
          letterSpacing: '-0.045em',
          marginTop: m ? '5px' : '6px',
          // A long name shrinks to fit rather than pushing the card wider.
          overflowWrap: 'anywhere',
        }}
      >
        {subjectName}
      </div>
      <div className="h-[4px] bg-red" style={{ marginTop: m ? '11px' : '12px' }} />
      <div
        className="flex items-end justify-between gap-4"
        style={{ marginTop: m ? '9px' : '10px' }}
      >
        <div
          className="font-mono font-bold uppercase text-ink-soft"
          style={{
            fontSize: m ? '9px' : '10px',
            letterSpacing: m ? '0.16em' : '0.2em',
            lineHeight: 1.8,
            whiteSpace: m ? 'nowrap' : undefined,
          }}
        >
          Eight counts · one suspect
          <br />
          Nobody leaves clean
        </div>
        {!m && (
          <div className="flex shrink-0 flex-col items-end gap-[5px]">
            {code && (
              <span
                className="font-mono uppercase text-ink-muted"
                style={{ fontSize: '10px', letterSpacing: '0.2em' }}
              >
                {code}
              </span>
            )}
            <span
              className="-rotate-2 bg-red font-mono font-bold uppercase text-bone"
              style={{ fontSize: '10px', letterSpacing: '0.2em', padding: '4px 10px' }}
            >
              Case open
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Fixed copy, and the one piece of the board written in a voice that is not the
// app's own.
function Letter({ m = false, pin }) {
  return (
    <div
      className="relative bg-paper-letter text-ink"
      style={{
        padding: '14px 16px 16px',
        transform: 'rotate(' + (m ? 2.2 : 1.8) + 'deg)',
        boxShadow: LIFT_MD,
      }}
    >
      <CardPin at={pin} />
      <div
        className="font-mono text-ink-muted"
        style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}
      >
        To Whom It May Concern —
      </div>
      <p className="mt-[9px] font-mono" style={{ fontSize: '13px', lineHeight: 1.5 }}>
        I’ve known this person for eleven years and I still couldn’t tell you their
        coffee order.
      </p>
      <p className="mt-[9px] font-mono" style={{ fontSize: '13px', lineHeight: 1.5 }}>
        Good luck. You’ll need it.
      </p>
      <div
        className="mt-[11px] border-t border-red pt-[7px] font-mono italic text-red-deep"
        style={{ fontSize: '10.5px' }}
      >
        — A former neighbour
      </div>
    </div>
  )
}

// Read straight off the real round list rather than typed into the copy, so a
// change to the game can never leave a stale bill on the landing page. Both
// design files print a different eight here - "sealed bids", "the frame",
// "cross-examination" - which is the one place their copy is out of date
// against `roundTypes.js`; the ledger titles everywhere else in both match.
function Counts({ m = false, pin }) {
  return (
    <div
      className="relative border border-line bg-panel"
      style={{
        borderLeft: '5px solid var(--color-red)',
        padding: m ? '14px 16px 14px' : '14px 18px 16px',
        transform: m ? 'rotate(-0.5deg)' : undefined,
        boxShadow: LIFT_LG,
      }}
    >
      <CardPin at={pin} />
      <div className="border-b border-line pb-2">
        <Label className="text-red-bright" size={m ? 9.5 : 10} tracking={m ? '0.22em' : '0.24em'}>
          The eight counts
        </Label>
      </div>
      <div className="mt-1 flex flex-col">
        {COUNTS.map((round, index) => (
          <div
            key={round.key}
            className={
              'flex items-baseline ' +
              (m ? 'gap-2.5 ' : 'gap-3 ') +
              (index < COUNTS.length - 1 ? 'border-b border-rule' : '')
            }
            style={{
              paddingTop: (m ? 8 : 5.5) + 'px',
              paddingBottom: (m ? 8 : 5.5) + 'px',
            }}
          >
            <span
              className="shrink-0 font-mono text-red-bright"
              style={{ fontSize: '10px', width: (m ? 28 : 26) + 'px' }}
            >
              {ledgerNumeral(index)}
            </span>
            <span
              className="min-w-0 truncate font-impact uppercase text-ivory"
              style={{ fontSize: '13px', letterSpacing: '-0.01em' }}
            >
              {round.label}
            </span>
            <span
              className="ml-auto shrink-0 font-mono text-dim"
              style={{ fontSize: '9.5px' }}
            >
              {LEDGER_MODES[round.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Marlowe({ m = false }) {
  return (
    <div
      className="border border-line bg-panel"
      style={{
        borderLeft: '5px solid var(--color-red)',
        padding: '12px 14px 14px',
        transform: 'rotate(' + (m ? 1.2 : 0.8) + 'deg)',
        boxShadow: m ? LIFT_MD : LIFT_MD,
      }}
    >
      <div className="font-impact uppercase text-ivory" style={{ fontSize: '15px' }}>
        Det. K. Marlowe
      </div>
      <Label
        className="mt-1 text-red-bright"
        size={m ? 8.5 : 9}
        tracking={m ? '0.18em' : '0.2em'}
      >
        Private investigator
      </Label>
      <div
        className="mt-2.5 border-t border-line pt-2 font-mono text-warm"
        style={{ fontSize: '10px', lineHeight: 1.7 }}
      >
        No fixed address
        <br />
        Available: never
      </div>
    </div>
  )
}

// The names here are both designs' own placeholder roster. This screen runs
// before any game exists, so there is no real board to read - but a plain
// name-and-rank list is the one prop here that reads like a LIVE lobby roster
// rather than a fictional one, unlike Det. K. Marlowe's card right next to it
// ("Available: never" is the tell that his is a joke). "The usual suspects"
// and "On file" borrow that same tell for this card, so it can't be mistaken
// for players who have actually joined.
const BOARD_ROSTER = [
  ['Priya', 'Sergeant'],
  ['Dez', 'Beat cop'],
  ['Ana', 'Detective'],
  ['Tomas', 'Beat cop'],
]

function OnTheBoard({ m = false, pin }) {
  const rowPad = (m ? 7 : 5) + 'px'
  return (
    <div
      className="relative bg-paper text-ink"
      style={{
        padding: '14px 16px 16px',
        transform: 'rotate(' + (m ? 1.4 : -0.8) + 'deg)',
        boxShadow: LIFT_MD,
        borderTop: '4px solid var(--color-red)',
      }}
    >
      <CardPin at={pin} />
      <Label className="text-red-deep" size={8.5} tracking="0.22em">
        The usual suspects
      </Label>
      <div className="mt-2">
        {BOARD_ROSTER.map(([who, rank]) => (
          <div
            key={who}
            className="flex items-baseline justify-between"
            style={{
              paddingTop: rowPad,
              paddingBottom: rowPad,
              borderBottom: '1px solid var(--color-paper-rule)',
            }}
          >
            <span className="font-mono" style={{ fontSize: '15px' }}>
              {who}
            </span>
            <span
              className="font-mono whitespace-nowrap uppercase text-ink-faint"
              style={{ fontSize: '8.5px', letterSpacing: '0.16em' }}
            >
              {rank}
            </span>
          </div>
        ))}
        <div
          className="flex items-baseline justify-between"
          style={{ paddingTop: rowPad, paddingBottom: rowPad }}
        >
          <span className="font-mono text-ink-faint" style={{ fontSize: '13px' }}>
            + 2 more
          </span>
          <span
            className="font-mono uppercase text-red-deep"
            style={{ fontSize: '8.5px', letterSpacing: '0.16em' }}
          >
            On file
          </span>
        </div>
      </div>
    </div>
  )
}

// Was loose type straight on the board - the one piece of copy on the whole
// page that read as an afterthought rather than a prop somebody actually
// pinned up. Snehin's call: dress it as the same sticky note the trip line
// uses, since "how many people, how long" is exactly the kind of practical
// scrawl that note is for.
function Facts({ m = false, tilt }) {
  return (
    <Sticky m={m} tilt={tilt}>
      <div
        className="font-mono uppercase"
        style={{
          fontSize: (m ? 10 : 11) + 'px',
          letterSpacing: '0.18em',
          lineHeight: m ? 1.9 : 1.85,
        }}
      >
        5–12 players
        <br />
        One phone each
      </div>
    </Sticky>
  )
}

export function CaseBoard({ fit, notes, hero, reportForDuty, creating, onCreate }) {
  const { scale, layerW, padY, offsets } = fit

  // Position a piece on the design's coordinates, inside its cluster.
  const at = (cluster, x, y, w) => ({
    position: 'absolute',
    left: offsets[cluster] + x + 'px',
    top: y + 'px',
    width: w + 'px',
  })

  // A pin is a piece too - this bundle draws them as their own elements rather
  // than as part of a card, because several of them sit off the card's centre
  // and none of them tilt with the paper.
  const pin = (cluster, x, y, size, tone) => ({
    position: 'absolute',
    left: offsets[cluster] + x + 'px',
    top: y + 'px',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '50%',
    background: tone === 'bone' ? 'var(--color-bone)' : 'var(--color-red)',
    boxShadow: '1px 2px 4px rgba(0,0,0,0.7)',
  })

  return (
    // Plain overflow-hidden, on Snehin's explicit call: no scroller anywhere
    // on this board, full stop, not even as an invisible fallback. The
    // scroll-fallback tried here briefly (`HANDOFF-19.md`) worked but was
    // rejected outright - the fix he wanted was for the sign-in card to stop
    // being the one piece whose height nothing else could plan around, not
    // for the board to grow an escape hatch for when it did. "Start as
    // host" now lives in its own fixed-height piece (`HostPiece`, placed
    // below the statement note) rather than inside the sign-in card, so the
    // card's remaining live-control rows (the resume-hosting banner, an
    // error message) have to run considerably longer than any observed case
    // has, before they could threaten this again.
    <div className="absolute inset-0 overflow-hidden">
      <div
        data-case-board=""
        style={{
          position: 'absolute',
          left: 0,
          top: padY * scale + 'px',
          width: layerW + 'px',
          height: BOARD_H + 'px',
          transform: 'scale(' + scale + ')',
          transformOrigin: 'top left',
        }}
      >
        {/* The one red wash the board gets, over the shell's own gradient. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 50%, rgba(208,36,26,0.10) 0%, rgba(208,36,26,0) 70%)',
          }}
          aria-hidden="true"
        />

        {/* CASE FILE, set enormous and barely lit. Behind everything. */}
        <div
          className="pointer-events-none absolute font-impact uppercase select-none"
          style={{
            left: offsets[MID] + 300 + 'px',
            top: '250px',
            fontSize: '210px',
            lineHeight: 0.85,
            letterSpacing: '-0.05em',
            color: 'var(--color-watermark)',
            whiteSpace: 'nowrap',
          }}
          aria-hidden="true"
        >
          Case
          <br />
          file
        </div>

        {/* The tape. Runs past both edges of the board on purpose. */}
        <div
          className="pointer-events-none absolute flex items-center overflow-hidden bg-red-tape"
          style={{
            left: '-60px',
            top: '470px',
            width: layerW + 120 + 'px',
            height: '46px',
            transform: 'rotate(-4.5deg)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
          }}
          aria-hidden="true"
        >
          <span
            className="font-mono font-bold whitespace-nowrap uppercase text-bone"
            style={{ fontSize: '15px', letterSpacing: '0.5em', paddingLeft: '20px' }}
          >
            Do not cross · do not cross · do not cross · do not cross · do not cross · do
            not cross · do not cross · do not cross · do not cross · do not cross
          </span>
        </div>

        {/* The thread. Stretched across whatever width the board ended up with -
            it is the one part of the collage that cannot keep fixed endpoints,
            because the pins it would tie to are in three clusters that move
            apart from each other. */}
        <svg
          className="pointer-events-none absolute top-0 left-0"
          style={{ width: layerW + 'px', height: BOARD_H + 'px' }}
          viewBox="0 0 1492 830"
          preserveAspectRatio="none"
          fill="none"
          stroke="var(--color-red)"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <polyline points="150,120 620,180 1320,60" opacity="0.85" />
          <polyline points="120,330 700,560 1345,350" opacity="0.7" />
          <polyline points="620,180 260,640 940,600" opacity="0.6" />
        </svg>

        {/* ── Left cluster ─────────────────────────────────────────────── */}
        <div style={at(LEFT, 16, 12, 252)}>
          <DailyPrecinct />
        </div>

        {notes[0] && (
          <>
            <div style={at(LEFT, 288, 26, 178)}>
              <NoteCard note={notes[0]} tilt={-2.4} />
            </div>
            <div style={pin(LEFT, 370, 18, 13)} aria-hidden="true" />
          </>
        )}

        {notes[1] && (
          <>
            <div style={at(LEFT, 296, 152, 186)}>
              <NoteCard note={notes[1]} tilt={1.6} tone="deep" />
            </div>
            <div style={pin(LEFT, 383, 144, 13)} aria-hidden="true" />
          </>
        )}

        {/* Shifted left from its original x=356 - Snehin's call, to land
            over the bend in the red thread's third polyline (the vertex at
            260,640) rather than sitting in the plain board beside it. */}
        <div style={at(LEFT, 220, 566, 200)}>
          <Facts />
        </div>

        {notes[2] && (
          <>
            <div style={at(LEFT, 14, 352, 182)}>
              <NoteCard note={notes[2]} tilt={-1} tone="deep" />
            </div>
            <div style={pin(LEFT, 88, 344, 13)} aria-hidden="true" />
          </>
        )}

        <div style={at(LEFT, 214, 352, 104)}>
          <Tally />
        </div>

        <div style={at(LEFT, 22, 470, 152)}>
          <Wanted />
        </div>

        {notes[4] && (
          <div style={at(LEFT, 196, 456, 122)}>
            <Sticky text={notes[4].text} />
          </div>
        )}

        <div style={at(LEFT, 20, 688, 178)}>
          <StillAtLarge />
        </div>
        <div style={pin(LEFT, 96, 680, 13, 'bone')} aria-hidden="true" />

        {/* ── Middle cluster ───────────────────────────────────────────── */}
        <div style={at(MID, 566, 96, 392)}>{hero}</div>
        <div style={pin(MID, 756, 88, 14, 'bone')} aria-hidden="true" />

        {/* Shifted further left of its original 452 - Snehin's call, to clear
            more room for the sign-in card next to it, which grew a "start as
            host" option of its own and asked for more width to hold it. */}
        {notes[3] && (
          <div style={at(MID, 380, 406, 154)}>
            <NoteCard note={notes[3]} tilt={-2} paper="bg-paper-aged" />
          </div>
        )}

        {/* Below the statement note and clear to the right of "Still at
            large" - Snehin's own spot for it, in the gap those two pieces
            leave between them rather than inside the sign-in card. */}
        <div style={at(MID, 430, 530, 172)}>
          <HostPiece creating={creating} onCreate={onCreate} />
        </div>
        <div style={pin(MID, 512, 522, 13, 'bone')} aria-hidden="true" />

        {/* The letter and Marlowe are middle-cluster rather than right, even
            though both sit right of centre on the design canvas. What decides
            it is which piece each one is pinned NEXT to, not which half of the
            board it is in: the letter sits 17px off the hero's shoulder and
            Marlowe 196px off the sign-in card, and both of those gaps are the
            composition. Only the piece that genuinely hugs the right edge in
            the design - 14px off it - travels with that edge. */}
        <div style={at(MID, 975, 196, 214)}>
          <Letter />
        </div>
        <div style={pin(MID, 1055, 188, 13)} aria-hidden="true" />

        <div style={at(MID, 1150, 600, 190)}>
          <Marlowe />
        </div>

        {/* ── Right cluster ────────────────────────────────────────────── */}
        <div style={at(RIGHT, 1288, 356, 190)}>
          <OnTheBoard />
        </div>
        <div style={pin(RIGHT, 1394, 348, 13)} aria-hidden="true" />

        {/* SWAPPED, on Snehin's call: the eight counts took the top-right slot
            the sign-in card used to hold, and the sign-in card took the middle
            slot under the hero. Both are anchored the way the card they replaced
            was - the counts panel by its right edge, so it still lands 8px off
            the board's edge - and the pins moved with them, each kept at the same
            fraction across its card that the design put it at.

            The counts panel is 280 wide here rather than its own 324. It is the
            piece that changed clusters, and the two clusters are at their
            CLOSEST when the board has no spare width to hand out - at 1440x790
            its full width reached 17px into the testimony letter, which is
            pinned to the hero's shoulder in the middle cluster and cannot move
            without breaking the relationship that puts it there. 280 clears the
            letter at zero slack with room to spare, and the rows still set
            without truncating; measured, not guessed. */}
        <div style={at(RIGHT, 1204, 14, 280)}>
          <Counts />
        </div>
        <div style={pin(RIGHT, 1336, 6, 13)} aria-hidden="true" />

        {/* Last on the board, and deliberately so. It is the only piece made of
            live controls, and the only one whose height is not fixed - an error
            banner or the host's resume row can push it 90px taller than the
            design draws it, straight through whatever is pinned below. A board
            is layers of paper, so the answer is the paper order: the thing you
            can actually press is the sheet on top. */}
        {/* Widened from its original 234 - Snehin's call, so the card that
            actually gets you into a game reads as the board's main event
            rather than one more scrap of evidence, and so it has room for
            the "start as host" option added underneath the join button.
            Moved up from y=452 too: the extra width bought extra height as
            well (the card wraps content, it does not shrink it), and the
            card's own bottom edge started running past `BOARD_H` into the
            fixed footer strip below the board - the "start as host" button
            was there, just physically covered by the ribbon on top of it. */}
        <div style={at(MID, 630, 372, 300)}>{reportForDuty}</div>
        <div style={pin(MID, 867, 364, 14, 'bone')} aria-hidden="true" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// THE PHONE BOARD
//
// 390 x 2420, straight off the mobile bundle's own card map, scaled on the
// width and scrolled. The scroller is the ONLY scroll surface on the screen;
// the header and the CTA float over it.
// ---------------------------------------------------------------------------

export function CaseBoardMobile({
  width,
  notes,
  code,
  busy,
  onGo,
  hero,
  reportForDuty,
}) {
  const scale = Math.min(Math.max(width, 1) / MOBILE_W, MOBILE_MAX_SCALE)

  const at = (x, y, w, z) => ({
    position: 'absolute',
    left: x + 'px',
    top: y + 'px',
    width: w == null ? undefined : w + 'px',
    zIndex: z,
  })

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="board-scroll absolute inset-0 overflow-x-hidden overflow-y-auto">
        <div
          style={{
            position: 'relative',
            width: MOBILE_W * scale + 'px',
            height: MOBILE_H * scale + 'px',
            marginInline: 'auto',
          }}
        >
          <div
            data-case-board-mobile=""
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: MOBILE_W + 'px',
              height: MOBILE_H + 'px',
              transform: 'scale(' + scale + ')',
              transformOrigin: 'top left',
              // This bundle draws its own ground rather than inheriting the
              // shell's: the gradient is pulled to the top of a canvas three
              // times the height of the window, not centred on it.
              background:
                'radial-gradient(120% 34% at 50% 8%, #33130a 0%, #1e0d06 40%, #120705 100%)',
              backgroundColor: 'var(--color-board)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(70% 22% at 50% 26%, rgba(208,36,26,0.10) 0%, rgba(208,36,26,0) 70%)',
              }}
              aria-hidden="true"
            />

            {/* Two ghost words rather than the desktop's one, the second darker
                and bleeding off the left edge. */}
            <div
              className="pointer-events-none absolute font-impact uppercase select-none"
              style={{
                left: '4px',
                top: '44px',
                fontSize: '96px',
                lineHeight: 0.82,
                letterSpacing: '-0.05em',
                color: 'var(--color-watermark)',
                whiteSpace: 'nowrap',
              }}
              aria-hidden="true"
            >
              Case
              <br />
              file
            </div>
            <div
              className="pointer-events-none absolute font-impact uppercase select-none"
              style={{
                left: '-30px',
                top: '1548px',
                fontSize: '128px',
                lineHeight: 0.8,
                letterSpacing: '-0.05em',
                color: 'var(--color-watermark-deep)',
                whiteSpace: 'nowrap',
              }}
              aria-hidden="true"
            >
              Open
            </div>

            <svg
              className="pointer-events-none absolute top-0 left-0"
              width={MOBILE_W}
              height={MOBILE_H}
              viewBox="0 0 390 2420"
              fill="none"
              stroke="var(--color-red)"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <polyline points="30,96 250,180 372,120" opacity="0.8" />
              <polyline points="14,392 210,560 380,470" opacity="0.6" />
              <polyline points="250,180 40,880 340,1010" opacity="0.45" />
              <polyline points="20,1420 260,1610 370,1500" opacity="0.5" />
              <polyline points="340,1010 60,1900 330,2050" opacity="0.4" />
            </svg>

            <div style={at(20, 74, 302, 6)}>{hero}</div>

            {notes[0] && (
              <div style={at(208, 246, 172, 8)}>
                <NoteCard note={notes[0]} tilt={3.2} m pin={120} />
              </div>
            )}

            {notes[4] && (
              <div style={at(12, 262, 118, 7)}>
                <Sticky text={notes[4].text} m />
              </div>
            )}

            {/* Bleeds both edges by design - it is the one card allowed to,
                because it carries no unique copy. */}
            <div
              className="pointer-events-none flex items-center overflow-hidden bg-red-tape"
              style={{
                ...at(-32, 336, 458, 9),
                height: '40px',
                transform: 'rotate(-5.2deg)',
                boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
              }}
              aria-hidden="true"
            >
              <span
                className="font-mono font-bold whitespace-nowrap uppercase text-bone"
                style={{ fontSize: '13px', letterSpacing: '0.42em', paddingLeft: '10px' }}
              >
                Do not cross · do not cross · do not cross · do not cross
              </span>
            </div>

            {notes[1] && (
              <div style={at(16, 400, 186, 6)}>
                <NoteCard note={notes[1]} tilt={-2.2} tone="deep" m pin={84} />
              </div>
            )}

            <div style={at(212, 424, 112, 5)}>
              <Tally m />
            </div>

            <div style={at(22, 506, null, 1)}>
              <Facts m />
            </div>

            <div style={at(26, 574, 322, 10)}>{reportForDuty}</div>

            <div style={at(-8, 886, 152, 7)}>
              <Wanted m />
            </div>

            {notes[2] && (
              <div style={at(152, 862, 176, 6)}>
                <NoteCard note={notes[2]} tilt={2.4} tone="deep" m pin={26} />
              </div>
            )}

            {notes[3] && (
              <div style={at(196, 970, 178, 5)}>
                <NoteCard note={notes[3]} tilt={-1.6} paper="bg-paper-aged" m />
              </div>
            )}

            <div style={at(18, 1082, 338, 8)}>
              <Counts m pin={158} />
            </div>

            <div style={at(34, 1462, 236, 8)}>
              <Letter m pin={176} />
            </div>

            <div style={at(222, 1636, 164, 9)}>
              <StillAtLarge m pin={30} />
            </div>

            <div style={at(-6, 1704, 248, 7)}>
              <DailyPrecinct m />
            </div>

            <div style={at(158, 2004, 220, 8)}>
              <OnTheBoard m pin={168} />
            </div>

            <div style={at(-6, 2062, 168, 7)}>
              <Marlowe m />
            </div>

            {/* The desktop's full-width red footer band becomes a plain line -
                on a phone the floor of the screen belongs to the CTA. Used to
                repeat "Running it yourself? Open a case" here too, 2400px
                down a scroll nobody was going to make - the one obvious way
                to host now lives in the sign-in card itself
                (`HANDOFF-19.md`), so this second, buried copy of it is gone
                rather than left as a confusing extra path. */}
            <div
              className="absolute font-mono font-bold uppercase text-dim"
              style={{
                left: 0,
                right: 0,
                top: '2288px',
                padding: '0 20px',
                fontSize: '9.5px',
                letterSpacing: '0.2em',
              }}
            >
              No account · no app · no mercy
            </div>
          </div>
        </div>
      </div>

      {/* The overlay header. Carries the pair the phone hero gives up, because
          an overlap may cover a card's padding but never its type. */}
      <div
        className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between
                   border-b border-line font-mono font-bold uppercase text-warm"
        style={{
          height: '32px',
          padding: '0 14px',
          background: 'rgba(18,7,5,0.94)',
          fontSize: '9px',
          letterSpacing: '0.2em',
        }}
      >
        <span className="min-w-0 truncate">{code ? 'Case ' + code : 'Do You Know Them'}</span>
        <span className="shrink-0 text-red-bright">Case open</span>
      </div>

      {/* The floating CTA, on a scrim to the page colour with a hard offset
          shadow so it reads as pinned on top of the board rather than as part
          of it. Lifted out of the sign-in card so it is reachable without
          scrolling 2400px of evidence first. */}
      <div
        className="absolute right-0 bottom-0 left-0 z-40"
        style={{
          background: 'linear-gradient(to top, var(--color-page) 62%, rgba(18,7,5,0))',
          padding: '22px 16px 16px',
        }}
      >
        <button
          type="button"
          onClick={onGo}
          disabled={busy}
          className="focus-ring flex w-full items-center justify-between bg-red font-impact
                     uppercase text-bone hover:bg-red-deep disabled:opacity-50"
          style={{
            height: '56px',
            padding: '0 18px',
            fontSize: '18px',
            boxShadow: '6px 7px 0 rgba(0,0,0,0.5)',
          }}
        >
          {busy ? 'Taking the case…' : 'Take the case'}
          <span className="font-mono" style={{ fontSize: '18px' }} aria-hidden="true">
            &rarr;
          </span>
        </button>
      </div>
    </div>
  )
}
