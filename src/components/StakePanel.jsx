import { Card, Eyebrow, Figure, Gloss } from '../ui.jsx'

// ---------------------------------------------------------------------------
// THE STAKE PANEL - betting your own points, before you know what you are
// betting on.
//
// It carries the accent border while the rest of the room stays hairline,
// because this is the one moment in the night where you commit to something
// you cannot see. The one red-bordered card on the screen is the warning.
//
// Used twice, deliberately by the same component: the Wager Final, where you
// bet before the question appears, and the Auction, where you bid on a topic
// without the question. They are the same decision, so they are the same
// control. The design bundle's own note on the wager screen (3C's stakes
// raised) says this explicitly - reusing the shape is deliberate.
//
// A SLIDER, NOT A LADDER OF FIXED AMOUNTS. The bundle draws four preset
// buttons - 5, 12, 20, THE LOT. Presets decide for people: they cannot bet 37,
// and anyone whose score sits below the smallest preset has no real choice at
// all. The slider covers every amount somebody could want, so it stays.
//
// The minus and plus keys beside it are not a second way of choosing an
// amount - they are how you land on an exact one. A slider on a 412px phone
// is roughly three points per pixel, so "bid exactly 40" is a thumb-fight
// without them.
// ---------------------------------------------------------------------------

export default function StakePanel({ label, amount, max, onChange, footnote }) {
  const clamp = (value) => Math.max(0, Math.min(max, value))

  return (
    <Card accent className="text-center">
      <div className="flex items-baseline justify-between">
        <Eyebrow className="text-dim" size={9.5}>
          {label}
        </Eyebrow>
        <Eyebrow className="text-dim" size={9.5}>
          Of {max} held
        </Eyebrow>
      </div>

      <div className="mt-2.5 flex items-baseline justify-center gap-2">
        <Figure size={58} tone="gain">
          {amount}
        </Figure>
        <span className="font-mono text-[18px] text-dim">pts</span>
      </div>

      {max > 0 ? (
        <>
          <div className="mt-5 flex items-center gap-3">
            <NudgeKey
              label="One point less"
              onClick={() => onChange(clamp(amount - 1))}
              disabled={amount <= 0}
              glyph="&minus;"
            />

            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={amount}
              onChange={(event) => onChange(clamp(Number(event.target.value)))}
              aria-label={label}
              className="stake-slider min-w-0 flex-1"
            />

            <NudgeKey
              label="One point more"
              onClick={() => onChange(clamp(amount + 1))}
              disabled={amount >= max}
              glyph="+"
            />
          </div>

          <div className="mt-2 flex justify-between">
            <Eyebrow className="text-dim" size={9.5} tracking="0.12em">
              Hedging
            </Eyebrow>
            <Eyebrow className="text-dim" size={9.5} tracking="0.12em">
              All in
            </Eyebrow>
          </div>
        </>
      ) : (
        <p className="mt-5 text-[14px] text-dim">
          You have no points to stake yet, so this one is a free ride.
        </p>
      )}

      {footnote && <Gloss className="mt-5 text-left">{footnote}</Gloss>}
    </Card>
  )
}

// A 46px square key. Same size as the rank arrows, for the same reason: it is
// being pressed with a thumb, repeatedly, on a phone.
function NudgeKey({ onClick, label, disabled, glyph }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="focus-ring grid h-[46px] w-[46px] shrink-0 place-items-center rounded-md border
                 border-line font-body text-[20px] text-ivory
                 disabled:cursor-not-allowed disabled:opacity-30"
      dangerouslySetInnerHTML={{ __html: glyph }}
    />
  )
}
