import { SweepRing } from '../ui.jsx'

// ---------------------------------------------------------------------------
// The strip along the top that tells you when something is wrong. This is the
// app's DISCONNECTED / RECONNECTING visual - built for real, not just decor,
// per the 29 August scope call (HANDOFF-7.md §3): tell someone their wifi
// dropped, but do not try to auto-refile a held draft on reconnect.
//
// This exists because of one rule: never fail silently. If the connection drops
// mid-game, or a save fails, it has to be visible. A frozen screen with no
// explanation is the thing that ruins the evening, not the fault itself.
//
// It is STICKY rather than fixed. Fixed took it out of the layout, so it sat on
// top of whatever was underneath - measured at 106px of a 375px-wide phone,
// which is the round banner and the top of the question. Sticky keeps it in
// view while you scroll and still pushes the page down instead of covering it.
//
// Restyled to the room language, and the reconnecting state now uses the
// design's own sweep spinner - a hand going round a ring, exactly as it
// appears everywhere else something is being waited on - rather than the old
// static warning glyph doing double duty for two different situations.
// ---------------------------------------------------------------------------

function BannerMark({ path }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  )
}

const WARNING = 'M12 4 L21 19 L3 19 Z M12 10 L12 14 M12 16.5 L12.01 16.5'

export default function ConnectionBanner({ connection, error, onDismiss }) {
  // A save failed. This is the more urgent of the two, so it interrupts
  // (`role="alert"`) rather than waiting to be noticed.
  if (error) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-50 w-full border-b border-red bg-red px-4 py-3 text-bone"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <BannerMark path={WARNING} />
          <p className="min-w-0 flex-1 font-body text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring min-h-[44px] shrink-0 border border-bone px-3 font-mono text-xs
                       text-bone uppercase"
            style={{ letterSpacing: '0.1em' }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss this message"
            className="focus-ring min-h-[44px] w-[44px] shrink-0 font-mono text-lg text-bone"
          >
            &times;
          </button>
        </div>
      </div>
    )
  }

  // The live connection dropped. We keep checking in the background, so this
  // usually fixes itself - say so, rather than alarming anyone. The sweep ring
  // is the same reconnecting spinner used everywhere else in the design, so a
  // dropped signal reads as "still working on it", not as an error state.
  if (connection === 'dropped') {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 w-full border-b border-line bg-panel px-4 py-2.5 text-ivory"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <SweepRing size={22} speed="sm" />
          <p className="min-w-0 flex-1 font-body text-sm font-semibold">
            Line dropped. Still trying, and checking for updates every few seconds.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring min-h-[44px] shrink-0 border border-line px-3 font-mono text-xs
                       text-ivory uppercase"
            style={{ letterSpacing: '0.1em' }}
          >
            Reconnect
          </button>
        </div>
      </div>
    )
  }

  return null
}
