import { Eyebrow } from '../ui.jsx'
import { formatCountdown } from '../useCountdown.js'

// ---------------------------------------------------------------------------
// THE HOST'S TIMER CONTROL - start one, extend it, or clear it.
//
// Deliberately simple, per the 29 August scope call (HANDOFF-7.md §3): a real
// timer, not decoration, but a plain one. No per-round default duration to
// configure at setup, no host docket overlay - just a row of buttons on
// whichever host screen can lock the round along (QuestionScreenHost,
// BiddingScreen, VotingScreen), because that lock handler is the thing a
// timer's expiry actually needs to reach.
//
// Shared by all three rather than three near-identical copies, so the look
// and the +30/clear behaviour can only ever drift in one place.
// ---------------------------------------------------------------------------
const START_OPTIONS = [30, 60, 90]

export default function TimerControl({ secondsLeft, onStart, onExtend, onClear, className = '' }) {
  const running = secondsLeft !== null && secondsLeft !== undefined

  if (!running) {
    return (
      <div className={'mt-3 flex flex-wrap items-center gap-2 ' + className}>
        <Eyebrow className="mr-1 text-dim" size={9.5} tracking="0.14em">
          Timer
        </Eyebrow>
        {START_OPTIONS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onStart(seconds)}
            className="focus-ring min-h-[36px] border border-line px-2.5 font-mono text-[11px]
                       text-ivory uppercase"
            style={{ letterSpacing: '0.08em' }}
          >
            {seconds}s
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={'mt-3 flex items-center justify-between gap-2 border border-red px-3 py-2 ' + className}>
      <span className="font-mono text-[18px] text-red tabular-nums">
        {formatCountdown(secondsLeft)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onExtend(30)}
          className="focus-ring min-h-[36px] border border-line px-2.5 font-mono text-[11px]
                     text-ivory uppercase"
          style={{ letterSpacing: '0.08em' }}
        >
          +30s
        </button>
        <button
          type="button"
          onClick={onClear}
          className="focus-ring min-h-[36px] border border-line px-2.5 font-mono text-[11px]
                     text-dim uppercase"
          style={{ letterSpacing: '0.08em' }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
