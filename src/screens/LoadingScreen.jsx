import {
  Screen,
  Region,
  Impact,
  Title,
  Eyebrow,
  RadarSweep,
  LoadingBar,
  LedgerDots,
  StatusStrip,
  FooterStrip,
} from '../ui.jsx'

// ---------------------------------------------------------------------------
// WAITING. Two screens, and the difference between them matters.
//
// THE SHORT LOAD is the everyday one: a hang while something saves or loads.
// Bundle 3 draws it as a full screen in its own right - a radar sweeping one
// half of the window, the headline and a real progress bar on the other - and
// that is deliberate: this is the screen a guest sees first, before anything
// else in the app has drawn, so it is the one that has to say "this is a
// working thing and it is doing something".
//
// THE FILM LEADER is the between-ledgers event - a countdown ring with the name
// of the ledger about to run. It is a moment, not a spinner.
//
// THE RULE THE DESIGN IS EMPHATIC ABOUT: never flash the full leader for a
// blink. A 232px countdown ring that appears and vanishes in 400ms reads as a
// glitch, not as a film leader. So the leader is only ever shown deliberately,
// for a transition that is genuinely a beat in the evening, and everything else
// gets the short load.
//
// Both say what they are waiting on. A blank screen is the single worst thing
// that can happen on the night, and "Loading…" is only marginally better.
// ---------------------------------------------------------------------------

export default function LoadingScreen({ message, detail, band, footer, roomCode }) {
  return (
    <Screen
      fixed
      pad={false}
      status={{
        left: <span className="text-red">{band?.left || 'Opening the file'}</span>,
        right: band?.right || (roomCode ? 'Case ' + roomCode : 'Do you know them'),
      }}
      footer={{
        left: 'No account · no app · no mercy',
        right: footer || 'Do you know them',
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        {/* The radar. Its own slightly-warmer ground and a dotted evidence grid
            behind it, so the illustration reads as a panel of the room rather
            than as a graphic floating on the page. */}
        <div className="relative hidden items-center justify-center overflow-hidden border-r-2 border-rule bg-board-warm/40 p-10 desktop:flex">
          <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <RadarSweep />
          <span
            className="absolute bottom-7 left-8 font-mono text-[10px] font-bold uppercase text-dim"
            style={{ letterSpacing: '0.22em' }}
          >
            Sweeping the precinct
          </span>
        </div>

        <Region className="justify-center gap-6 desktop:justify-between desktop:py-11">
          {/* The phone gets the radar too, just smaller and above the words -
              there is no second column to give it, and a loading screen with
              nothing moving on it is the one thing this screen must not be. */}
          <div className="mx-auto w-[180px] shrink-0 desktop:hidden">
            <RadarSweep />
          </div>

          <div className="hidden desktop:block" />

          <div className="flex flex-col gap-5 desktop:mb-10">
            <Title size="lg">{message || 'Pulling the file.'}</Title>

            <p className="max-w-[46ch] font-mono text-[13px] leading-[1.7] text-warm desktop:text-[16px]">
              {detail ||
                'Eight ledgers. One suspect. Nobody in this room is going to come out of it looking good.'}
            </p>

            <div className="flex max-w-[620px] flex-col gap-2.5">
              <LoadingBar />
              <div
                className="flex justify-between gap-4 font-mono text-[9px] font-bold uppercase text-dim desktop:text-[10px]"
                style={{ letterSpacing: '0.2em' }}
              >
                <span>Waking the detectives</span>
                <span className="shrink-0">Do not close this tab</span>
              </div>
            </div>
          </div>
        </Region>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// THE FILM LEADER
//
// Shown between ledgers, over a real transition rather than on a timer that
// guesses. `count` is the numeral in the middle; pass `null` and the ring runs
// without one, which is what to do when the wait is not a countdown.
//
// `progress` is a real 0-1 fraction, not a fake crawl. The design draws a
// progress bar and calls it a real one; a bar that animates to 90% and sticks
// is a lie the player learns to distrust within two ledgers.
//
// Wired in on `CategoryResultsScreen`, host-side only, per `HANDOFF-8.md` §5 -
// the room-synced version this screen was originally drawn for would need a new
// server-pushed game phase for a two-second flourish with no effect on scoring,
// which was judged not worth it. A future session can revisit that call; the
// component itself does not change either way.
//
// This one builds its own frame rather than going through `Screen`, because it
// is a full-bleed beat with no content region: the chrome is the whole screen.
// ---------------------------------------------------------------------------
export function FilmLeader({
  count,
  exhibit,
  ledgerName,
  tagline,
  progress = 0,
  standingBy,
  roomCode,
  ledgerIndex,
  ledgerTotal,
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100
  const hasLedgerCount = typeof ledgerIndex === 'number' && typeof ledgerTotal === 'number' && ledgerTotal > 0

  return (
    <div className="board-ground relative flex h-screen w-full flex-col overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <StatusStrip
        left={<span className="text-red">Ledger change</span>}
        right={roomCode ? 'Case ' + roomCode : null}
        className="relative"
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-5 desktop:grid desktop:grid-cols-2 desktop:items-center desktop:gap-0 desktop:px-0">
        {/* The countdown ring: an outer circle, an inner ring, a crosshair and
            a sweep hand, all cut from the one accent colour. */}
        <div
          className="relative grid h-[232px] w-[232px] shrink-0 place-items-center rounded-full
                     border border-red desktop:h-[320px] desktop:w-[320px] desktop:justify-self-center"
          aria-hidden="true"
        >
          <div className="absolute inset-[22px] rounded-full border border-red/35" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red/35" />
          <div className="absolute right-0 left-0 top-1/2 h-px bg-red/35" />

          <div className="sweep-arm absolute inset-0">
            <div
              className="absolute top-0 left-1/2 w-[2px] origin-bottom"
              style={{
                height: '50%',
                background:
                  'linear-gradient(180deg, var(--color-red-bright), rgba(208, 36, 26, 0.15))',
              }}
            />
          </div>

          {count !== null && count !== undefined && (
            <span className="relative font-impact text-[122px] leading-none text-ivory desktop:text-[170px]">
              {count}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3.5 px-2 text-center desktop:items-start desktop:gap-5 desktop:px-12 desktop:text-left">
          <Eyebrow className="text-red" size={10} tracking="0.26em">
            {exhibit}
          </Eyebrow>
          <Impact size={40} className="text-ivory">
            {ledgerName}
          </Impact>
          {tagline && (
            <p className="font-body text-[16px] text-warm italic desktop:max-w-[36ch] desktop:text-[20px]">
              {tagline}
            </p>
          )}
          {hasLedgerCount && (
            <LedgerDots total={ledgerTotal} filled={ledgerIndex} className="mt-2 hidden desktop:flex" />
          )}
        </div>
      </div>

      <div className="gutter relative flex shrink-0 flex-col gap-2.5 pb-5">
        <div className="h-[6px] w-full bg-rule">
          <div
            className="h-full bg-red transition-[width] duration-300"
            style={{ width: pct + '%' }}
          />
        </div>
        <div
          className="flex justify-between gap-4 font-mono text-[9px] font-bold uppercase text-dim desktop:text-[10px]"
          style={{ letterSpacing: '0.2em' }}
        >
          <span>Squaring the paperwork</span>
          {standingBy && <span className="shrink-0">{standingBy}</span>}
        </div>
      </div>

      <FooterStrip left="Ledger change · hold on" right={roomCode} className="relative" />
    </div>
  )
}
