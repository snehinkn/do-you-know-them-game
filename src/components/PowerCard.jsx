import { tierOfCard } from '../powerUps.js'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// One favour, drawn as a case-file card rather than a row in a list. THE
// LEVERAGE's own object.
//
// It is the same card whether you are holding it or being handed it, so this is
// one component used in both places. Give it an `onClick` and it becomes a
// button; leave it off and it is a static card, which is what the handout on
// the round-results screen needs.
//
// Everything a player needs is printed on the card. Nobody should ever have to
// remember what they are holding, or ask what something does while seven other
// people wait.
//
// Restyled to the room language - the tier band is the one place besides the
// timer that a second colour temptation shows up (Basic/Advanced/Mayhem each
// had their own hue). Kept to red-on-ink and ink-on-red, tier told by a
// Courier numeral rather than a colour, so the four-colour rule holds.
// ---------------------------------------------------------------------------

export default function PowerCard({ card, onClick, selected = false, size = 34 }) {
  const say = useSay()
  if (!card) return null

  const tier = tierOfCard(card.key)
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={
        'focus-ring flex min-h-[188px] flex-col overflow-hidden border bg-panel p-0 text-left ' +
        (onClick ? 'cursor-pointer hover:bg-board-warm ' : '') +
        (selected ? 'border-red' : 'border-line')
      }
    >
      <div
        className={
          'flex items-center justify-between border-b px-2.5 py-[7px] ' +
          (selected ? 'border-red bg-red text-bone' : 'border-line')
        }
      >
        <span
          className={
            'font-mono text-[9.5px] uppercase ' + (selected ? '' : 'text-dim')
          }
          style={{ letterSpacing: '0.16em' }}
        >
          {tier.label}
        </span>
        <span className="font-mono text-[11px] uppercase" style={{ letterSpacing: '0.14em' }}>
          {tier.numeral}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 px-3 py-3.5 text-center">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-red"
        >
          <path d={card.mark} />
        </svg>
        <span className="font-impact text-[17px] leading-[1.05] text-ivory uppercase">
          {say(card.name)}
        </span>
        <span className="text-[12.5px] leading-relaxed text-dim">
          {say(card.description)}
        </span>
      </div>

      {card.flavour && (
        <div className="border-t border-dashed border-line px-2.5 py-[7px] text-center">
          <span className="font-body text-[11px] text-dim italic">{say(card.flavour)}</span>
        </div>
      )}
    </Tag>
  )
}
