import { useState, useEffect } from 'react'
import { badgeAt, BADGES } from './badge.js'
import { ledgerNumeral } from './roundIdentity.js'
import { questionFit } from './typeFit.js'
import { formatCountdown } from './useCountdown.js'
import { scaleClampPx, rs } from './responsiveSize.js'

// ---------------------------------------------------------------------------
// Shared look-and-feel pieces used by every screen.
// Small and boring on purpose: change a colour here and it changes everywhere.
// The actual colour values live in index.css.
//
// THE HOUSE STYLE, IN FIVE RULES (bundle 3):
//
//   1. RED IS THE ONLY COLOUR IN THE ROOM. Not the main colour - the only one.
//      Whatever is red on a screen is the thing the player is meant to look
//      at, so spending it on a second thing costs you the first. At most ONE
//      red field per screen beyond the chrome.
//
//   2. THREE FACES, EACH WITH ONE JOB. Archivo Black shouts and is always
//      uppercase - headlines, buttons, every large numeral. Archivo carries
//      sentences. Courier Prime carries EVERY figure, code, timer and
//      small-caps label, plus anything a player typed. The Courier rule is
//      absolute and is what makes the whole system read as a case file.
//
//   3. RADIUS IS ZERO EVERYWHERE, and shadows are hard offsets, never blurred.
//      Only paper cards cast one, and a paper card always carries all three of
//      shadow, slight rotation, and a red pin - or none of them.
//
//   4. DESKTOP IS FULL BLEED. Content runs to both edges behind a 40px gutter.
//      There is no centred max-width column anywhere. Screens divide themselves
//      with grid columns separated by 2px rules - real regions, not cards
//      floating on an empty field. This is the specific thing bundle 3 was
//      drawn to fix, and undoing it undoes the redesign.
//
//   5. A GAIN IS RED; A LOSS IS GREY. Never green. Losing points at somebody's
//      party is funny, not an error state, and colouring it like a failure is
//      the fastest way to make a joke land as a telling-off.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE SHELL
// ---------------------------------------------------------------------------

// The app frame. Every screen is one of these.
//
// The shape is fixed and comes straight from the bundle: a thin status strip
// at the top, an optional full-bleed red ledger band under it, the screen's own
// content in the middle, and a 30px red footer strip along the bottom. The
// three chrome pieces are full-bleed and pinned; only the middle ever moves.
//
// `fixed` pins the three chrome pieces to the window - the frame becomes
// exactly the window's height - while the content area in the middle is the
// one place that scrolls if it ever has to. On a phone that almost never
// fires: every screen is tuned to fit a known ~812px. On a desktop window,
// which has no such floor, it is the ordinary page-scroll fallback for a
// screen that ran long - the reveal screen's own results list, a lobby with
// enough players to fill the room, a question sharing its column with a tall
// input. See the content wrapper below.
//
// The one screen the bundle allows to scroll ALWAYS rather than only when it
// must is host setup, which passes `scroll`.
//
// `pad` puts the standard gutter (20px phone / 40px laptop) on the content
// region. A screen laying itself out as full-bleed columns - each with its own
// padding and a 2px rule between them - passes `pad={false}` and handles it.
export function Screen({
  children,
  fixed = false,
  scroll = false,
  centerY = false,
  pad = true,
  status,
  band,
  footer,
  roomCode,
  className = '',
}) {
  // A screen that says nothing about its own status strip but knows the room
  // code still gets the bundle's standard right-hand slot, because every
  // in-app screen in the design carries one.
  const strip =
    status === false
      ? null
      : status || (roomCode ? { right: 'Case ' + roomCode } : null)

  return (
    <div
      className={
        'board-ground relative w-full ' +
        (fixed ? 'h-screen overflow-hidden ' : 'min-h-screen ')
      }
      style={{ overflowX: 'clip' }}
    >
      <div
        className={
          'dykt-shell relative flex flex-col ' +
          (fixed ? 'h-screen overflow-hidden ' : 'min-h-screen ') +
          className
        }
      >
        {strip && <StatusStrip {...strip} />}
        {band}
        {/* The content region, and the ONE place a screen ever scrolls.
            `overflow-y-auto` is on unconditionally: a screen must never be
            able to put content past the bottom of the window with no way to
            reach it, which is precisely what happened to the lobby's
            host-link panel on a real laptop (`HANDOFF-13.md` §3). `Region`s no
            longer claim their own overflow (`HANDOFF-19.md`) - a screen built
            from them just grows, and if a laptop window is too short for all
            of it, this scrolls as one ordinary page rather than one column
            growing a private scrollbar while its neighbour sits still. Below
            the breakpoint nothing changes: every phone screen is tuned to fit
            and simply never overflows. */}
        <div
          className={
            'relative flex min-h-0 flex-1 flex-col overflow-y-auto ' +
            (pad ? 'gutter py-5 desktop:py-7 ' : '') +
            (centerY ? 'justify-center ' : '') +
            (scroll ? 'overflow-x-hidden ' : '')
          }
        >
          {children}
        </div>
        {footer && <FooterStrip {...footer} />}
      </div>
    </div>
  )
}

// The thin strip along the top of every app screen. Left is the phase or a
// clock; right is the player's badge and rank, or the case number.
//
// Full bleed with its own gutter and a 2px rule underneath, because it is
// chrome rather than content - it belongs to the window, not to the column
// layout inside it.
export function StatusStrip({ left, right, className = '' }) {
  return (
    <div
      className={
        'gutter flex shrink-0 items-center justify-between gap-4 border-b-2 border-rule ' +
        'py-[15px] desktop:py-[14px] font-mono text-[9.5px] desktop:text-[11px] font-bold ' +
        'uppercase text-dim ' +
        className
      }
      style={{ letterSpacing: '0.2em' }}
    >
      <span className="min-w-0 truncate">{left}</span>
      <span className="min-w-0 shrink-0 truncate text-right">{right}</span>
    </div>
  )
}

// The ledger header band: a full-bleed red bar with the ledger numeral and title
// in Archivo Black on the left and the progress or timer in Courier on the
// right, both in bone. Never black type on red.
export function LedgerBand({ title, right, className = '' }) {
  return (
    <div
      className={
        'gutter flex shrink-0 items-center justify-between gap-4 bg-red py-[14px] ' +
        'desktop:py-[15px] text-bone ' +
        className
      }
    >
      <span
        className="min-w-0 truncate font-impact text-[16px] desktop:text-[22px] uppercase"
        style={{ letterSpacing: '-0.01em' }}
      >
        {title}
      </span>
      {right && (
        <span
          className="shrink-0 font-mono text-[11px] desktop:text-[13px] font-bold uppercase"
          style={{ letterSpacing: '0.2em' }}
        >
          {right}
        </span>
      )}
    </div>
  )
}

// The 30px red strip along the floor of the screen. Carries the running gag
// and, on the right, whatever the room needs to hand: the case number, the way
// out. Deliberately the smallest type in the app - nothing you must read to
// play is ever set this small.
export function FooterStrip({ left, right, onRight, className = '' }) {
  return (
    <div
      className={
        'flex h-[28px] desktop:h-[30px] shrink-0 items-center justify-between gap-4 bg-red ' +
        'px-[18px] desktop:px-[22px] font-mono text-[9px] desktop:text-[10px] font-bold ' +
        'uppercase text-bone ' +
        className
      }
      style={{ letterSpacing: '0.2em' }}
    >
      <span className="min-w-0 truncate">{left}</span>
      {onRight ? (
        <button
          type="button"
          onClick={onRight}
          className="focus-ring shrink-0 truncate underline underline-offset-2"
        >
          {right}
        </button>
      ) : (
        <span className="min-w-0 shrink-0 truncate text-right">{right}</span>
      )}
    </div>
  )
}

// The big headline block under the chrome, ruled off from the screen with the
// 3px red line the bundle puts under "the section that owns the screen".
export function HeadlineBand({ children, eyebrow, right, className = '' }) {
  return (
    <div
      className={
        'gutter shrink-0 border-b-[3px] border-red pt-5 pb-4 desktop:pt-[26px] desktop:pb-5 ' +
        className
      }
    >
      <div className="flex items-end justify-between gap-8">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <Eyebrow className="mb-2 text-red" size={10} tracking="0.26em">
              {eyebrow}
            </Eyebrow>
          )}
          {children}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  )
}

// One column of a full-bleed desktop layout.
//
// The rule between two columns is a BORDER on the column, not a gap. That is
// the whole difference between "a desktop app" and "two phone screens side by
// side": regions that meet, rather than cards floating apart on a field. On
// mobile the border and the padding both collapse to the single column the
// phone design actually draws.
//
// A region used to scroll INSIDE ITSELF whenever its own content ran taller
// than the row it was given - meant as the fix for `LobbyScreen`'s host-link
// panel going permanently unreachable on a real laptop (`HANDOFF-13.md`). It
// overcorrected: a region's own `overflow-y-auto` claims any overflow for
// itself before the page ever sees it, so the app grew a private, easy-to-miss
// scrollbar in whichever column happened to run long - the reveal screen's
// results list, the lobby's player grid, a question squeezed by a tall input
// next to it (the number pad shrank The Estimate's own question to a sliver
// this way, `HANDOFF-19.md`). Snehin asked for the ordinary shape instead: one
// ordinary page scroll on the CONTENT AREA when something runs long, not a
// private scrollbar in every column that might.
//
// A region now simply takes the height its content needs. `Screen`'s own
// content wrapper is the one place that scrolls - see the comment there - so
// the chrome (status strip, ledger band, footer) still stays pinned exactly as
// before; only the middle of the screen grows and, if it must, scrolls as one
// piece rather than column by column.
export function Region({ children, edge, className = '' }) {
  const edges = {
    left: 'desktop:border-l-2 desktop:border-rule ',
    right: 'desktop:border-r-2 desktop:border-rule ',
  }
  return (
    <div
      // `shrink-0` is about what a region is on a PHONE, where it is not a
      // column at all - it is one block in a single stack, and it must keep
      // its natural height rather than being squashed by a sibling fighting
      // for the same space. (It is inert on desktop - grid items do not use
      // it.) `min-w-0` is unrelated to scrolling - it lets long text truncate
      // or wrap inside a narrow column instead of forcing the column wider.
      className={
        'flex min-w-0 shrink-0 flex-col px-5 py-5 desktop:px-[30px] desktop:py-[26px] ' +
        (edges[edge] || '') +
        className
      }
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SURFACES
// ---------------------------------------------------------------------------

// A dark panel on the board. The default carries the 5px red left spine the
// bundle puts on "a primary panel"; `plain` drops it for the secondary boxes
// that sit alongside one.
//
// `flat` drops the border and fill on desktop only, for a card being merged
// into a larger panel by its parent, so the room never ends up with two nested
// boxes where one was meant.
export function Card({
  children,
  accent = false,
  hero = false,
  plain = false,
  flat = false,
  className = '',
}) {
  return (
    <div
      className={
        'border border-rule bg-panel ' +
        (plain ? '' : 'border-l-[5px] border-l-red ') +
        (accent ? 'border-red ' : '') +
        (hero ? 'px-5 py-5 desktop:px-6 desktop:py-6 ' : 'px-4 py-4 desktop:px-[18px] desktop:py-[18px] ') +
        (flat ? 'desktop:border-transparent desktop:bg-transparent desktop:px-0 desktop:py-0 ' : '') +
        className
      }
    >
      {children}
    </div>
  )
}

// A pinned bone card - the one paper surface in the room.
//
// The bundle is unusually firm here: "Every paper card carries three things
// together, or none of them: a hard offset shadow, a 0.5-1.2 degree rotation,
// and a red pin. A paper card without a pin is a mistake." So all three come
// from one class rather than three separate decisions at each call site.
//
// Paper means "read this, it is on the record" - the room code, the badge, the
// host link, the answer well. It is not a general-purpose card and spending it
// on one costs the meaning everywhere else.
export function PaperCard({ children, tilt = 'left', className = '' }) {
  return (
    <div
      className={
        'paper-card ' +
        (tilt === 'right' ? 'paper-card-alt ' : '') +
        'px-5 py-5 desktop:px-6 desktop:py-[22px] ' +
        className
      }
    >
      {children}
    </div>
  )
}

// A square panel in the room, with no spine. Used where a box is holding a
// list rather than making a point.
export function Plate({ children, hero = false, className = '' }) {
  return (
    <div className={'border bg-panel ' + (hero ? 'border-red ' : 'border-rule ') + className}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TYPE
// ---------------------------------------------------------------------------

// A screen title, or a question. Archivo Black, uppercase, set large and very
// tight - the poster face doing the reading as well as the shouting.
//
// LONG QUESTIONS FIT THEMSELVES. Pass a plain string and the type is sized
// from its length by `questionFit`, so a long one wraps downward onto more
// lines at a smaller size instead of walking off the bottom of the phone. A
// question is never truncated and never scrolls.
//
// Pass `size` explicitly to override that - for a fixed screen title where the
// wording cannot change and the size is a design decision rather than a
// fitting problem.
//
// DESKTOP GETS A TALLER CEILING, not a re-tuning. `typeFit.js`'s bands are
// tested against a 412px phone and their whole point is the ceiling, so this
// does not touch them: `scaleClampPx` scales the two px bounds of the
// resulting clamp for a desktop-width screen only, via a CSS custom property
// `.title-fit` reads. The `cqw` preference in the middle is left alone.
//
// NEVER put a plain inline `fontSize` on a headline that also wants a
// `desktop:text-[Npx]` class - inline style beats a class at every width, and
// three headlines in this app were silently stuck at their mobile size for
// weeks because of exactly that. Both sizes go through this mechanism.
// `scale` is the desktop multiplier. Was 1.75 - Snehin's own call on
// `HANDOFF-19.md` was that even the ordinary case ran too big on a real
// desktop window, not just the tall-input rounds this file already scaled
// down further. 1.4 now.
export function Title({ children, size, scale = 1.4, className = '' }) {
  const sizes = {
    // The densities the design uses, keyed to the 390px phone frame.
    xl: 'clamp(34px, 13cqw, 48px)',
    lg: 'clamp(30px, 12cqw, 44px)',
    md: 'clamp(28px, 11cqw, 40px)',
    sm: 'clamp(23px, 9cqw, 33px)',
  }

  const auto = !size && typeof children === 'string'
  const fit = auto ? questionFit(children) : null
  const baseFontSize = fit ? fit.fontSize : sizes[size] || sizes.md

  return (
    <h1
      className={'title-fit font-impact uppercase text-ivory ' + className}
      style={{
        '--title-size': baseFontSize,
        // 1.75 rather than 1.6: the frame is now the whole window rather than a
        // capped column, and the bundle's own desktop headlines run 58-108px
        // against a mobile 26-62px.
        '--title-size-desktop': scaleClampPx(baseFontSize, scale),
        lineHeight: fit ? fit.lineHeight : 0.88,
        letterSpacing: '-0.04em',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </h1>
  )
}

// The shouting one. Poster headlines, ledger titles, badge names, and the
// player's verdict on a reveal - short lines only, always uppercase.
export function Impact({ children, size = 40, className = '', style = {} }) {
  const numeric = typeof size === 'number'
  return (
    <div
      className={'font-impact uppercase ' + (numeric ? 'rs-text ' : '') + className}
      style={{
        ...(numeric ? rs(size, 1.5) : { fontSize: size }),
        letterSpacing: '-0.03em',
        lineHeight: 0.92,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// The italic voice line - the gloss that carries the joke. Always secondary to
// whatever it is glossing.
export function Gloss({ children, className = '' }) {
  return (
    <p
      className={'rs-text font-body leading-[1.5] italic text-warm ' + className}
      style={rs(14, 1.15)}
    >
      {children}
    </p>
  )
}

// Small uppercase label with wide letter spacing - Courier, because every
// label, figure and status line in this design is Courier. Used above inputs,
// as eyebrow text over headlines, and as the caption along the bottom.
//
// The tracking tightens as the size grows, which is why it is a prop rather
// than one fixed value.
export function Eyebrow({ children, size = 10, tracking = '0.22em', className = '' }) {
  return (
    <p
      className={'rs-text font-mono font-bold uppercase ' + className}
      style={{ ...rs(size, 1.1), letterSpacing: tracking }}
    >
      {children}
    </p>
  )
}

// The caption pinned along the bottom of a column. Deliberately the smallest
// thing in the region.
export function FooterCaption({ children, className = '' }) {
  return (
    <p
      className={'rs-text font-mono leading-[1.9] uppercase text-dim ' + className}
      style={{ ...rs(9.5, 1.1), letterSpacing: '0.16em' }}
    >
      {children}
    </p>
  )
}

// A big figure - a stake, a score, a swing. Archivo Black, because the bundle
// sets every large numeral in the display face and reserves Courier for
// figures at label size.
//
// `tone` is the whole point: a gain is red, a loss is grey, and there is no
// third option. Passing a colour here by hand is how the room ends up with two
// accents in it.
export function Figure({ children, size = 42, tone = 'plain', className = '' }) {
  const tones = {
    gain: 'text-red-bright',
    plain: 'text-ivory',
    loss: 'text-dim',
    red: 'text-red',
  }
  return (
    <div
      className={'rs-text font-impact leading-none ' + (tones[tone] || tones.plain) + ' ' + className}
      style={{ ...rs(size, 1.5), letterSpacing: '0.02em' }}
    >
      {children}
    </div>
  )
}

// The round's alias - "Thoth, Scribe", "Loki, obviously". Courier, wide,
// quiet, so an alias reads as a caption and never as a heading.
export function GodName({ children, className = '' }) {
  return (
    <span
      className={'rs-text font-mono uppercase text-dim ' + className}
      style={{ ...rs(10), letterSpacing: '0.2em' }}
    >
      {children}
    </span>
  )
}

// The deadpan line a screen carries exactly one of. It is the running gag of
// the app, so it never states anything that can change - no round counts, no
// scores, nothing that could quietly go stale mid-game.
export function OneLiner({ children, className = '' }) {
  return (
    <p
      className={'font-mono text-[9.5px] leading-[1.9] uppercase text-dim ' + className}
      style={{ letterSpacing: '0.16em' }}
    >
      {children}
    </p>
  )
}

// A panel's heading: the shouting face, a 2px rule underneath, and an optional
// label pushed to the right.
export function PanelHeading({ children, right, className = '' }) {
  return (
    <div
      className={
        'flex shrink-0 flex-wrap items-baseline justify-between gap-3 border-b-2 border-rule ' +
        'pb-[9px] ' +
        className
      }
    >
      <h2
        className="font-impact text-[17px] uppercase text-ivory desktop:text-[24px]"
        style={{ letterSpacing: '-0.02em' }}
      >
        {children}
      </h2>
      {right && (
        <span
          className="shrink-0 font-mono text-[9px] font-bold uppercase text-dim desktop:text-[10px]"
          style={{ letterSpacing: '0.2em' }}
        >
          {right}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RULES AND MARKS
// ---------------------------------------------------------------------------

// A horizontal rule. `accent` marks a section that owns the screen; `hairline`
// separates ledger rows and is nearly invisible on purpose.
export function Rule({ tone = 'line', className = '' }) {
  const tones = {
    accent: 'h-[3px] bg-red',
    line: 'h-[2px] bg-line',
    hairline: 'h-px bg-rule',
  }
  return <div className={'w-full ' + (tones[tone] || tones.line) + ' ' + className} />
}

// The live status dot - a small red circle that breathes. One of the bundle's
// three animations, and the only one that appears more than once.
export function PulseDot({ className = '' }) {
  return (
    <span
      className={'pulse-dot inline-block h-2 w-2 shrink-0 rounded-full bg-red ' + className}
      aria-hidden="true"
    />
  )
}

// A live status line: the dot, then what the room is waiting for.
export function LiveNote({ children, className = '' }) {
  return (
    <div className={'flex items-center gap-2 ' + className}>
      <PulseDot />
      <span
        className="font-mono text-[9px] font-bold uppercase text-red-bright desktop:text-[10px]"
        style={{ letterSpacing: '0.16em' }}
      >
        {children}
      </span>
    </div>
  )
}

// A drawn mark in an outlined box. Used for rounds and power-up cards -
// anywhere the old build had an emoji. There are no images in this design at
// all; every mark is a path.
export function Mark({ path, size = 26, boxed = true, band = '', className = '' }) {
  const glyph = (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (!boxed) return <span className={className}>{glyph}</span>

  return (
    <span
      className={
        'inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center border border-line ' +
        'text-dim ' +
        band +
        ' ' +
        className
      }
    >
      {glyph}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CONTROLS
// ---------------------------------------------------------------------------

// The main action button.
//
// FILLED RED WITH BONE TYPE, in Archivo Black, with the label pushed left and
// an arrow at the far right. It is the loudest object on any screen it appears
// on - which is correct, because there is only ever one of them and it is the
// thing that moves the night along.
//
// A disabled primary goes to the flat `line` fill rather than dimming the red,
// because the bundle draws it that way and because a 35%-opacity red still
// reads as "the red thing on this screen" from across a room.
//
// Everything that is NOT the main action is a 2px rule on nothing, so the gap
// between "the button" and "a button" is unmissable at arm's length in a dark
// room.
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  arrow,
  className = '',
}) {
  const base =
    'focus-ring inline-flex w-full items-center transition-colors ' +
    'disabled:cursor-not-allowed'

  const showArrow = arrow !== false && (variant === 'primary' || variant === 'poster')

  const variants = {
    // The one thing this screen is for.
    primary:
      'min-h-[62px] desktop:min-h-[76px] justify-between px-5 desktop:px-6 font-impact ' +
      'text-[21px] desktop:text-[26px] uppercase ' +
      (disabled ? 'bg-line text-dim ' : 'bg-red text-bone hover:bg-red-deep '),
    // A real choice, but not the one being pushed.
    secondary:
      'min-h-[46px] desktop:min-h-[52px] justify-center border-2 border-line px-5 ' +
      'font-body text-[13px] desktop:text-[14px] font-semibold uppercase text-warm ' +
      'hover:border-red hover:text-ivory disabled:opacity-40',
    // A ruling against, on the scoring screen. Deliberately NOT red - "not a
    // chance" is a punchline, not a failure, and colouring it like a warning
    // makes the subject look cross rather than funny.
    against:
      'min-h-[46px] desktop:min-h-[52px] justify-center border-2 border-line px-4 text-center ' +
      'font-mono text-[10px] font-bold uppercase text-warm hover:border-red hover:text-ivory ' +
      'disabled:opacity-40',
    // The outlined heavyweight: same size as the primary, but hollow. Used
    // where the action is real but the screen has already spent its red field.
    poster:
      'min-h-[58px] desktop:min-h-[78px] justify-between border-2 border-red bg-transparent ' +
      'px-5 desktop:px-6 font-impact text-[20px] desktop:text-[26px] uppercase text-ivory ' +
      'hover:bg-red hover:text-bone disabled:opacity-40',
    // The quiet one: no box, just underlined text.
    ghost:
      'min-h-0 w-auto justify-start px-1 py-1 font-mono text-[10px] desktop:text-[11px] font-bold ' +
      'uppercase text-warm underline underline-offset-4 hover:text-red disabled:opacity-40',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={base + ' ' + (variants[variant] || variants.primary) + ' ' + className}
      style={
        variant === 'ghost' || variant === 'against'
          ? { letterSpacing: '0.16em' }
          : { letterSpacing: '-0.02em' }
      }
    >
      <span className={variant === 'primary' || variant === 'poster' ? 'text-left' : ''}>
        {children}
      </span>
      {showArrow && (
        <span className="ml-4 shrink-0 font-mono text-[19px]" aria-hidden="true">
          &rarr;
        </span>
      )}
    </button>
  )
}

// The full-width control that moves the game on. One per screen.
export function BigButton({ children, onClick, disabled = false, className = '' }) {
  return (
    <Button variant="primary" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </Button>
  )
}

// The quiet way out of a screen. Underlined Courier rather than a box, so it
// never competes with the button above it, but still a full 44px tall.
export function TextLink({ children, onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'focus-ring inline-block min-h-[44px] px-1 py-2 font-mono text-[10px] font-bold ' +
        'uppercase text-warm underline underline-offset-4 hover:text-red ' +
        'disabled:cursor-not-allowed disabled:opacity-40 desktop:text-[11px] ' +
        className
      }
      style={{ letterSpacing: '0.18em' }}
    >
      {children}
    </button>
  )
}

// A text input with a label above it, and an optional line of help underneath.
//
// ONE input treatment for the whole app, and every field uses this component
// rather than styling its own. That is the point: on the join screen the name
// box and the room code box sit one above the other, and if the code box were
// heavier or more widely tracked - the obvious instinct, since a code is a code
// - the pair reads as a mistake. Identical is correct, and the only way to keep
// them identical for good is for there to be one of them.
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  onEnter,
  onBlur,
  hint,
  autoFocus = false,
  // The name of the subject, on the setup sheet: bone paper, the display face,
  // and a 4px red rule under it rather than a box. The bundle draws the one
  // field the whole night is about differently from every other field, and
  // this is that field.
  paper = false,
  // The case number, which is read aloud across a room: Courier at 30px with
  // wide tracking and a red border.
  code = false,
  className = '',
}) {
  function handleKeyDown(event) {
    if (event.key === 'Enter' && onEnter) onEnter()
  }

  return (
    <label className={'block ' + className}>
      {label && (
        <Eyebrow className="mb-2 text-dim" size={10} tracking="0.24em">
          {label}
        </Eyebrow>
      )}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        // 62px is a tap target first and a look second. The design's own floor
        // for a hit target on a phone is 44px; nothing here goes near it.
        className={
          // The caret is red. The design draws a blinking red block on its mock
          // fields; a real input already has a caret, so it is coloured rather
          // than faked - two carets on one field would be a bug.
          'focus-ring caret-red h-[56px] w-full desktop:h-[62px] ' +
          (paper
            ? 'border-0 border-b-4 border-red bg-paper px-4 font-impact text-[24px] uppercase ' +
              'text-ink placeholder:text-ink-faint desktop:text-[28px] '
            : code
              ? 'border-2 border-red bg-panel px-4 font-mono text-[26px] uppercase text-ivory ' +
                'placeholder:text-dim/50 desktop:text-[32px] '
              : 'border-2 border-line bg-panel px-4 font-body text-[18px] text-ivory ' +
                'placeholder:text-dim/50 desktop:text-[20px] ')
        }
        style={code ? { letterSpacing: '0.3em' } : paper ? { letterSpacing: '-0.01em' } : undefined}
      />
      {hint && (
        <span className="rs-text mt-2 block leading-[1.6] text-warm" style={rs(13.5, 1.1)}>
          {hint}
        </span>
      )}
    </label>
  )
}

// The small count pill, red-outlined. Only ever shows something derived live,
// never a number typed into the copy, so it cannot go stale.
export function CountPill({ children, className = '' }) {
  return (
    <span
      className={
        'rs-text inline-flex items-center border-2 border-red px-3.5 py-[6px] font-mono ' +
        'font-bold uppercase text-red-bright ' +
        className
      }
      style={{ ...rs(10), letterSpacing: '0.2em' }}
    >
      {children}
    </span>
  )
}

// A dashed empty slot - a badge nobody has taken yet. The design uses these
// everywhere a roster has room left in it, and they are what make an empty
// muster read as "waiting" rather than "broken".
export function EmptySlot({ label = 'Badge open', number, className = '' }) {
  return (
    <div
      className={
        'flex min-h-[52px] flex-col items-center justify-center gap-1.5 border-2 border-dashed ' +
        'border-rule px-2 text-center ' +
        className
      }
    >
      {number !== undefined && (
        <span className="font-mono text-[15px] text-rule desktop:text-[22px]">{number}</span>
      )}
      <span
        className="font-mono text-[8px] font-bold uppercase text-ghost desktop:text-[9px]"
        style={{ letterSpacing: '0.2em' }}
      >
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// THE CASE NUMBER
// ---------------------------------------------------------------------------

// The case number on paper, big, for the screens where somebody reads it out
// across a room. This is the single most important object on the muster
// screen, so it gets the full paper treatment: pinned, lifted, tilted.
export function RoomCodeBadge({ code, note, className = '' }) {
  return (
    <PaperCard className={className}>
      <div
        className="font-mono text-[9.5px] font-bold uppercase text-red-deep desktop:text-[10px]"
        style={{ letterSpacing: '0.26em' }}
      >
        Read them this
      </div>
      <div
        className="mt-1 font-impact leading-none text-red"
        style={{ fontSize: 'clamp(44px, 15cqw, 56px)', letterSpacing: '0.06em' }}
      >
        {code}
      </div>
      <div className="mt-2.5 h-[3px] bg-red" />
      {note && (
        <div className="mt-3 font-body text-[13.5px] leading-[1.6] text-ink-soft desktop:text-[14.5px]">
          {note}
        </div>
      )}
    </PaperCard>
  )
}

// The case number set as a dark plate on a red band - the treatment the setup
// sheet's own header uses, where the surrounding field is already red.
export function RoomPlate({ code, className = '' }) {
  return (
    <div className={'inline-block bg-board px-[18px] pt-2 pb-2.5 text-left ' + className}>
      <div
        className="font-mono text-[9px] font-bold uppercase text-red-bright"
        style={{ letterSpacing: '0.24em' }}
      >
        Room
      </div>
      <div
        className="font-impact text-[26px] leading-none text-ivory desktop:text-[34px]"
        style={{ letterSpacing: '0.06em' }}
      >
        {code}
      </div>
    </div>
  )
}

// The private host link is the ONLY thing that makes somebody the host - there
// is no login or password behind it. Close that tab and the link is gone, and
// with it the ability to advance the game for everybody else. Her own phone now
// remembers it, but that cannot help her if the phone itself dies, so this
// panel lets her stash a spare copy somewhere else before the night starts.
//
// Deliberately host-only. A guest must never see this link: anyone holding it
// IS the host. On paper, because it is a document being handed over.
//
// The clipboard can refuse - it needs a secure context, and Safari rejects it
// outright when the call is not judged to be a direct response to a tap. So a
// failure falls back to showing the link in a read-only box she can select by
// hand, rather than leaving her with a button that silently did nothing.
// THE KEY COMES FROM THE ADDRESS BAR, NOT FROM THE GAME.
//
// It used to be passed in as `game.hostKey`, which meant the key had to travel
// to every device the game loaded on - including all the players'. Holding the
// key IS being the host, so that quietly handed every guest the ability to run
// (or delete) the night, while this very card told the host not to share it.
//
// The host is the only person who ever sees this card, and the only person
// whose address bar already carries the key, so reading it from there needs no
// delivery at all. Read inline rather than imported from `useGame.js` to keep
// the shared UI file free of a dependency on the game's data layer.
export function HostLinkPanel({ className = '' }) {
  const [state, setState] = useState('idle') // 'idle' | 'copied' | 'manual'

  let hostKey = null
  try {
    hostKey = new URLSearchParams(window.location.search).get('host')
  } catch {
    hostKey = null
  }

  if (!hostKey) return null

  const link = window.location.origin + window.location.pathname + '?host=' + hostKey

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setState('copied')
      window.setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('manual')
    }
  }

  return (
    <PaperCard className={className}>
      <div className="font-impact text-[19px] uppercase desktop:text-[22px]" style={{ letterSpacing: '-0.02em' }}>
        Keep a spare key
      </div>
      <div className="my-3 h-[3px] bg-red" />
      <p className="font-body text-[13.5px] leading-[1.6] text-ink-soft desktop:text-[14px]">
        This link is the only thing that makes you the host. Send it to yourself
        now — if your phone dies, it is the way back in. Don&apos;t share it with
        the players.
      </p>

      <button
        type="button"
        onClick={handleCopy}
        className="focus-ring mt-4 flex h-[50px] w-full items-center justify-center border-2
                   border-ink font-mono text-[12px] font-bold uppercase transition-colors
                   hover:border-red hover:bg-red hover:text-bone desktop:text-[13px]"
        style={{ letterSpacing: '0.2em' }}
      >
        {state === 'copied' ? 'Copied to your clipboard' : 'Copy my host link'}
      </button>

      {state === 'manual' && (
        <div className="mt-3">
          <p className="mb-1.5 font-body text-[13px] text-ink-muted">
            Your browser wouldn&apos;t let me copy it. Press and hold the link
            below to copy it yourself.
          </p>
          <input
            type="text"
            readOnly
            value={link}
            onFocus={(event) => event.target.select()}
            className="paper-field w-full border-2 border-ink px-2.5 py-2 font-mono text-[12px]"
          />
        </div>
      )}
    </PaperCard>
  )
}

// ---------------------------------------------------------------------------
// DECORATION
// ---------------------------------------------------------------------------

// The radar sweep - the loading screen's whole left column, and the only
// illustration in the product. Inline SVG: there are no image assets in this
// design at all.
export function RadarSweep({ className = '' }) {
  return (
    <svg
      viewBox="0 0 460 460"
      className={'h-auto w-full max-w-[460px] ' + className}
      aria-hidden="true"
    >
      <circle cx="230" cy="230" r="220" fill="none" stroke="var(--color-line)" strokeWidth="1.5" />
      <circle cx="230" cy="230" r="165" fill="none" stroke="var(--color-rule)" strokeWidth="1.5" />
      <circle cx="230" cy="230" r="110" fill="none" stroke="var(--color-rule)" strokeWidth="1.5" />
      <circle cx="230" cy="230" r="55" fill="none" stroke="var(--color-rule)" strokeWidth="1.5" />
      <line x1="10" y1="230" x2="450" y2="230" stroke="var(--color-rule)" strokeWidth="1" />
      <line x1="230" y1="10" x2="230" y2="450" stroke="var(--color-rule)" strokeWidth="1" />
      <g className="sweep-arm" style={{ transformOrigin: '230px 230px' }}>
        <path d="M230 230 L230 10 A220 220 0 0 1 385 75 Z" fill="var(--color-red)" opacity="0.18" />
        <line x1="230" y1="230" x2="230" y2="10" stroke="var(--color-red-bright)" strokeWidth="2.5" />
      </g>
      <circle cx="318" cy="150" r="6" fill="var(--color-red-bright)" className="pulse-dot" />
      <circle cx="140" cy="300" r="5" fill="var(--color-red)" className="pulse-dot" style={{ animationDelay: '0.7s' }} />
      <circle cx="298" cy="330" r="4" fill="var(--color-red)" className="pulse-dot" style={{ animationDelay: '1.4s' }} />
      <circle cx="230" cy="230" r="7" fill="var(--color-ivory)" />
    </svg>
  )
}

// A clock hand going round a ring - the small inline version of the radar, for
// a screen that needs to say "working" without giving up a whole column.
export function SweepRing({ size = 54, label, className = '' }) {
  return (
    <div
      className={'relative shrink-0 rounded-full border border-line ' + className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="sweep-arm absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 w-[2px] origin-top bg-red"
          style={{ height: size / 2 - 2, marginLeft: -1 }}
        />
      </div>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-[9.5px] uppercase text-dim"
            style={{ letterSpacing: '0.14em' }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  )
}

// The indeterminate loading bar - one of the bundle's three animations.
export function LoadingBar({ className = '' }) {
  return (
    <div className={'h-2 w-full overflow-hidden bg-rule ' + className} aria-hidden="true">
      <div className="load-bar h-full w-full bg-red" />
    </div>
  )
}

// The row of numbered squares marking how far into the night the room is.
// `filled` is a plain count, not a list, because a ledger that has not run yet
// has no identity worth carrying here - only "done" or "not done" is real.
export function LedgerDots({ total, filled, className = '' }) {
  return (
    <div className={'flex flex-wrap gap-1.5 ' + className} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const done = index < filled
        return (
          <span
            key={index}
            className={
              'grid h-[28px] w-[28px] place-items-center font-mono text-[10px] font-bold ' +
              'uppercase desktop:h-[38px] desktop:w-[38px] desktop:text-[11px] ' +
              (done ? 'border-2 border-red bg-red text-bone' : 'border-2 border-rule text-dim')
            }
            style={{ letterSpacing: '0.06em' }}
          >
            {ledgerNumeral(index)}
          </span>
        )
      })}
    </div>
  )
}

// How much of the scoring is done. A bar rather than a number because the
// subject is reading answers, not counting them.
export function ProgressBar({ done, total, className = '' }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className={'h-[6px] w-full overflow-hidden bg-rule ' + className}>
      <div className="h-full bg-red transition-[width] duration-300" style={{ width: pct + '%' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// STATUS
// ---------------------------------------------------------------------------

// A live clock, HH:MM, re-read on the minute rather than every render - the
// status strip is not a stopwatch, it just has to look like a phone.
function useClock() {
  const [label, setLabel] = useState(() => formatClock())
  useEffect(() => {
    const timer = setInterval(() => setLabel(formatClock()), 15000)
    return () => clearInterval(timer)
  }, [])
  return label
}

function formatClock() {
  const now = new Date()
  let hours = now.getHours() % 12
  if (hours === 0) hours = 12
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return hours + ':' + minutes + (now.getHours() < 12 ? ' AM' : ' PM')
}

// The live clock that sits on the left of every player's status strip. A
// component rather than a hook so that ui.jsx keeps exporting components and
// nothing else - a file that mixes the two breaks fast refresh, and this
// project already carries one such exception it does not want a second of.
export function Clock() {
  return <>{useClock()}</>
}

// The right-hand half of a player's status strip: their badge number and rank,
// with the rank in red.
//
// This is the one place the rank system lives ALL NIGHT rather than only in the
// two-second rank card. `connection` swaps the rank for GONE DARK the moment
// the realtime connection drops, so a dropped signal is visible even on a
// screen that otherwise looks normal. (It read OFF THE AIR until 4 September -
// a broadcast phrase on a case board, and a cousin of the "reel" that went the
// same day.)
//
// Host screens never render one - the host is the guest of honour, not a
// competing player, and has no rank to carry.
export function PlayerTag({ badgeNo, badge, connection = 'live' }) {
  if (!badge) return null
  return (
    <>
      Det. {badgeNo} <span aria-hidden="true">&middot;</span>{' '}
      {connection === 'dropped' ? (
        <span>Gone dark</span>
      ) : (
        <span className="text-red">{badge.name}</span>
      )}
    </>
  )
}

// THE TIME LEFT CELL - a bordered countdown, shown on any screen where a player
// is being timed. The figure is Archivo Black in red-bright, per the bundle's
// own "TIME LEFT" cell, and the whole panel reddens once the design's ten-second
// threshold is crossed, so the last stretch is felt rather than just read.
//
// Renders nothing at all when no timer is running, so a screen that includes
// this unconditionally costs nothing on a night the host never starts one.
export function TimeLeft({ secondsLeft, total, className = '' }) {
  if (secondsLeft === null || secondsLeft === undefined) return null
  const low = secondsLeft <= 10
  const pct = total > 0 ? Math.max(0, Math.min(100, (secondsLeft / total) * 100)) : null

  return (
    <div
      className={
        'border border-rule border-l-[5px] bg-panel px-4 py-3.5 desktop:px-[18px] desktop:py-4 ' +
        (low ? 'border-l-red-bright ' : 'border-l-red ') +
        className
      }
    >
      <div
        className="font-mono text-[9.5px] font-bold uppercase text-dim desktop:text-[10px]"
        style={{ letterSpacing: '0.22em' }}
      >
        Time left
      </div>
      <div
        className={
          'font-impact leading-[1.05] tabular-nums ' + (low ? 'text-red-bright' : 'text-ivory')
        }
        style={{ fontSize: 'clamp(34px, 11cqw, 50px)', letterSpacing: '0.02em' }}
      >
        {formatCountdown(secondsLeft)}
      </div>
      {pct !== null && (
        <div className="mt-2.5 h-[6px] w-full bg-rule">
          <div className="h-full bg-red" style={{ width: pct + '%' }} />
        </div>
      )}
    </div>
  )
}

// The player's badge, full size. This is their anchor object: it is the first
// thing they are given on joining, and it is paper because a badge is a
// document being handed over, not something happening under a timer.
export function BadgeCard({ badgeNo, badge, gloss = true, roomCode, className = '' }) {
  return (
    <PaperCard className={className}>
      <div
        className="flex items-baseline justify-between font-mono text-[9px] font-bold uppercase
                   text-red-deep desktop:text-[10px]"
        style={{ letterSpacing: '0.22em' }}
      >
        <span>Badge issued</span>
        {roomCode && <span>Case {roomCode}</span>}
      </div>
      <div
        className="mt-1 font-impact leading-[0.92]"
        style={{ fontSize: 'clamp(56px, 18cqw, 84px)', letterSpacing: '0.02em' }}
      >
        {badgeNo}
      </div>
      <div className="mt-3 mb-3 h-[3px] bg-red" />
      <div className="font-impact text-[25px] uppercase desktop:text-[30px]" style={{ letterSpacing: '-0.02em' }}>
        {badge.name}
      </div>
      {gloss && (
        <p className="mt-1.5 font-body text-[13.5px] leading-[1.6] text-ink-soft desktop:text-[14.5px]">
          {badge.gloss}
        </p>
      )}
    </PaperCard>
  )
}

// The five ranks, butted together in a row, lit at wherever this player
// currently sits. The bundle draws this under the badge on the waiting screen
// and again on the rank card, so it is one component rather than two.
export function RankLadder({ at, short = false, className = '' }) {
  return (
    <div
      className={'grid ' + className}
      style={{ gridTemplateColumns: 'repeat(' + BADGES.length + ', minmax(0, 1fr))' }}
      aria-hidden="true"
    >
      {BADGES.map((badge, index) => {
        const lit = index === at
        return (
          <div
            key={badge.name}
            className={
              'flex h-[44px] items-center justify-center px-1 text-center font-mono text-[8px] ' +
              'font-bold uppercase desktop:h-[42px] desktop:text-[9.5px] ' +
              (lit ? 'border-2 border-red bg-red text-bone ' : 'border-2 border-line text-dim ') +
              (index > 0 ? 'border-l-0 ' : '')
            }
            style={{ letterSpacing: short ? '0.1em' : '0.14em' }}
          >
            {short ? badge.short || badge.name : badge.name}
          </div>
        )
      })}
    </div>
  )
}

// One row of a ledger: who, what they did, and the figure it came to.
//
// A panel row rather than a bare line - the bundle draws standings as boxed
// rows on the board, with the leader carrying a red left spine. The figure sits
// in its own right-hand column so a column of them stays a column; the
// commonest way a ledger like this goes wrong is one three-digit score knocking
// every other row out of line.
export function LedgerRow({
  name,
  detail,
  figure,
  figureTone = 'plain',
  rank,
  pending = false,
  first = false,
  className = '',
}) {
  const figureTones = {
    gain: 'text-red-bright',
    loss: 'text-dim',
    plain: 'text-ivory',
  }
  return (
    <div
      className={
        'grid items-center gap-3 border border-rule bg-panel px-3.5 py-3 desktop:gap-4 ' +
        'desktop:px-4 desktop:py-[13px] ' +
        (first ? 'border-l-4 border-l-red ' : '') +
        className
      }
      style={{ gridTemplateColumns: (rank !== undefined ? '28px ' : '') + '1fr auto' }}
    >
      {rank !== undefined && (
        <span className="font-mono text-[13px] text-dim desktop:text-[15px]">{rank}</span>
      )}
      <div className="min-w-0">
        <div
          className={
            'truncate font-body font-semibold ' +
            (pending ? 'italic text-dim ' : first ? 'text-red-bright ' : 'text-ivory ')
          }
          style={{ fontSize: 'clamp(14px, 4.2cqw, 17px)' }}
        >
          {name}
        </div>
        {detail && (
          <div
            className="mt-[3px] truncate font-mono text-[9px] font-bold uppercase text-dim desktop:text-[9.5px]"
            style={{ letterSpacing: '0.18em' }}
          >
            {detail}
          </div>
        )}
      </div>
      {figure !== undefined && figure !== null && (
        <span
          className={
            'shrink-0 text-right font-impact text-[18px] desktop:text-[22px] ' +
            (figureTones[figureTone] || figureTones.plain)
          }
        >
          {figure}
        </span>
      )}
    </div>
  )
}

// Anything that went wrong. We always show problems on screen, never a blank
// page, never a silent failure.
//
// `role="alert"` so a screen reader announces it the moment it appears - a
// sighted player notices new red text on their own screen, but without this a
// blind player would have to go looking for it, on a control they may not even
// know just failed.
export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="mb-4 border border-rule border-l-[5px] border-l-red bg-panel px-4 py-3
                 font-body text-[13.5px] text-ivory desktop:px-5 desktop:py-4 desktop:text-[15px]"
    >
      {message}
    </div>
  )
}

// A hidden value, covered by a solid bar.
//
// The bar sits perfectly still while it is hidden - no shimmer, no pulse,
// because a bar that moves reads as loading rather than as concealing. It wipes
// off left-to-right when `lifted` goes true, and every bar in a group lifts
// together. That one moment is the whole special effect of this design, so
// nothing else in the app is allowed to animate like it.
//
// The value stays in the DOM underneath, so a screen reader would happily read
// out a sealed bid. `aria-hidden` while covered is therefore not decoration -
// it is the only thing actually keeping the bid secret from assistive tech.
export function Redacted({ children, lifted = false, className = '' }) {
  return (
    <span
      className={'redaction ' + (lifted ? 'redaction-lifting ' : '') + className}
      aria-hidden={!lifted}
    >
      {children}
    </span>
  )
}

// One selectable option - a statement in a line-up, an item in a list.
//
// 62px minimum, because this is the control a player taps under time pressure
// in a dark room while somebody shouts at them.
//
// `own` is the player's own decoy: it stays in the list, dashed and marked, so
// the letters everybody can see still match what the host is reading out.
// Dropping it would silently renumber the options on one phone.
//
// IT IS NO LONGER SWITCHED OFF. `own` is matched on the words a player wrote,
// not on authorship - the ballot deliberately carries no authorship, which is
// what stops it giving the round away - and the second audit found the case
// that breaks: write a lie that happens to be the real answer and the truth
// itself came up dashed and dead on your phone. The ballot no longer lists a
// duplicate of the truth at all (see `fibbageOptions`), and this control now
// only marks your own answer rather than refusing it. The rule that you cannot
// score off your own lie lives in `scoreFibbage`, where the points are worked
// out, which is where it belongs and where nobody can tap around it.
export function OptionRow({
  letter,
  children,
  selected = false,
  own = false,
  onClick,
  right,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // On a phone this is a row in a stack. In a `desktop:grid` it becomes a
      // genuine card instead - taller than it is wide, the label up top and the
      // letter and status pushed to the corners - which is how the bundle draws
      // statements side by side, rather than short bars that look squat next to
      // each other.
      className={
        'focus-ring flex min-h-[62px] w-full items-center gap-3 border-2 px-3.5 text-left ' +
        'transition-colors desktop:min-h-[180px] desktop:flex-col desktop:items-start ' +
        'desktop:justify-between desktop:gap-4 desktop:px-5 desktop:py-5 ' +
        // Your own answer still reads as yours - dashed and quiet, so nobody
        // votes for it by accident - but it is pickable now, and picking it is
        // simply worth nothing.
        (selected
          ? 'border-red bg-panel '
          : own
            ? 'border-dashed border-rule bg-transparent hover:border-red '
            : 'border-line bg-panel hover:border-red ') +
        className
      }
    >
      <span className="w-[14px] shrink-0 font-mono text-[10px] uppercase text-red-bright desktop:w-auto desktop:text-[13px]">
        {letter}
      </span>
      {/* Courier, not the body face - every option this control has ever shown
          is a statement somebody typed, and the design's own rule is that typed
          text reads back as typewritten evidence. */}
      <span
        className={
          'flex-1 font-mono text-[14.5px] leading-[1.4] desktop:flex-none desktop:text-[19px] ' +
          (own ? 'text-dim' : 'text-ivory')
        }
      >
        {children}
      </span>
      {(right || own || selected) && (
        <span
          className="shrink-0 font-mono text-[10px] font-bold uppercase desktop:text-[11px]"
          style={{ letterSpacing: '0.16em' }}
        >
          {/* "Picked" beats "Yours" - now that your own answer can be chosen,
              the label has to say what you just did, not what it is. */}
          {selected ? (
            <span className="text-red-bright">Picked</span>
          ) : own ? (
            <span className="text-dim">Yours</span>
          ) : (
            right
          )}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// THE FULL-BLEED MOMENTS
//
// Two screens take the whole window and drop the chrome entirely. Both are
// beats rather than screens - they hold for a second or two and release.
// ---------------------------------------------------------------------------

// The departmental notice, shown for about two seconds when a badge actually
// moves. No button - it dismisses itself.
//
// Up and down are one object flipping polarity, not two designs: red ground
// with bone type going up, board ground with red type coming down. Same
// headline, same rules in the same places.
export function RankCard({ move, points, standing }) {
  const up = move.direction === 'up'
  const ruleColour = up ? 'bg-bone' : 'bg-red'

  return (
    <div
      className={
        'relative flex h-screen w-full flex-col justify-center ' +
        (up ? 'bg-red text-bone' : 'board-ground text-red-bright')
      }
      role="status"
    >
      {!up && <div className="dot-grid pointer-events-none absolute inset-0" />}

      <div className="gutter relative desktop:grid desktop:grid-cols-[1fr_340px] desktop:items-center desktop:gap-16">
        <div>
          <div
            className="font-mono text-[10px] font-bold uppercase desktop:text-[12px]"
            style={{ letterSpacing: '0.24em' }}
          >
            Departmental notice
          </div>
          <div className={'mt-3 h-[3px] w-full ' + ruleColour} />

          <Impact size={54} className="mt-6">
            {up ? 'You made' : 'Back to'}
            <br />
            {move.badge.name}.
          </Impact>

          <div
            className="mt-6 font-mono text-[14px] font-bold uppercase desktop:text-[18px]"
            style={{ letterSpacing: '0.12em' }}
          >
            <span className="line-through opacity-60">{badgeAt(move.from).name}</span>
            <span className="mx-2">&rarr;</span>
            <span>{move.badge.name}</span>
          </div>

          <p
            className={
              'mt-5 max-w-[46ch] font-body text-[16px] leading-[1.5] desktop:text-[20px] ' +
              (up ? 'text-on-red' : 'text-warm')
            }
          >
            {move.badge.gloss}
          </p>

          <div className={'mt-6 h-[3px] w-full ' + ruleColour} />

          <div
            className="mt-4 flex items-baseline justify-between font-mono text-[12px] font-bold
                       uppercase desktop:text-[15px]"
            style={{ letterSpacing: '0.18em' }}
          >
            <span>{points} pts</span>
            <span>{standing}</span>
          </div>
        </div>

        {/* The ladder, lit to wherever this promotion just landed. Nothing here
            is invented - `move.to` is the same index the headline above is
            already reporting, just shown against its neighbours. */}
        <div className="mt-8 hidden desktop:mt-0 desktop:flex desktop:flex-col desktop:gap-2">
          {[...BADGES].reverse().map((badge) => {
            const index = BADGES.indexOf(badge)
            const lit = index === move.to
            return (
              <div
                key={badge.name}
                className={
                  'flex items-center justify-between px-4 py-3 font-mono text-[13px] font-bold uppercase ' +
                  (lit
                    ? up
                      ? 'bg-bone text-red'
                      : 'bg-red text-bone'
                    : 'border-2 ' + (up ? 'border-bone/35' : 'border-line'))
                }
                style={{ letterSpacing: '0.12em' }}
              >
                <span>{badge.name}</span>
                {lit && <span className="text-[11px]">&larr; here</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// TOO SLOW - the timer-expired state. Full red, because the content notes are
// explicit that this is the ONE place the product is allowed to be rude to a
// player - and that it softens immediately, in the very next line.
//
// Shown locally the instant a player's own countdown reaches zero without a
// submission, which can land a beat before the host's own lock actually moves
// the game on. That gap is fine: nothing here claims the round is over, only
// that this phone stopped taking input.
export function TooSlow({ detail }) {
  return (
    <div
      className="relative flex h-screen w-full flex-col justify-center bg-red text-bone"
      role="status"
    >
      <div className="gutter relative desktop:max-w-[900px]">
        <div
          className="font-mono text-[10px] font-bold uppercase desktop:text-[12px]"
          style={{ letterSpacing: '0.24em' }}
        >
          Time&apos;s called
        </div>
        <div className="mt-3 h-[3px] w-full bg-bone" />

        <Impact size={54} className="mt-6">
          Too slow.
        </Impact>

        <p className="mt-5 max-w-[46ch] font-body text-[16px] leading-[1.5] desktop:text-[21px]">
          Happens to everyone. Nothing you had typed is held against you — it
          just never went in.
        </p>

        {detail && (
          <p className="mt-3 max-w-[46ch] font-body text-[14px] leading-[1.5] text-on-red desktop:text-[18px]">
            {detail}
          </p>
        )}

        <div className="mt-6 h-[3px] w-full bg-bone" />
        <p
          className="mt-4 font-mono text-[10px] font-bold uppercase text-on-red"
          style={{ letterSpacing: '0.16em' }}
        >
          Waiting for the room to move on
        </p>
      </div>
    </div>
  )
}
