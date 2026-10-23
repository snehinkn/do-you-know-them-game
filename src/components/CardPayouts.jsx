import { Plate, Eyebrow, Mark } from '../ui.jsx'
import { findCard } from '../powerUps.js'
import { useSay } from '../subjectContext.js'
import { findPlayer, cardsPlayedOn } from '../gameHelpers.js'

// ---------------------------------------------------------------------------
// CARD PAYOUTS - host only, reveal screen.
//
// Three cards - Wildcard, Bonus Question, Vote of Confidence - ask the guest
// of honour to decide an amount out loud (see `PowerUpNotices`), and then need
// that amount recorded somewhere. This is that somewhere: a fixed row of
// buttons per card, built from the card's own `payoutOptions`, so she can
// never award anything the card doesn't actually offer. Replaces the old
// free-form +/- score fixer, which could hand any number to anyone and was
// removed for exactly that reason.
//
// Tapping a different button OVERWRITES the amount rather than adding to it -
// changing her mind corrects it instead of stacking two payouts on one card.
//
// Restyled to the room language.
// ---------------------------------------------------------------------------

export default function CardPayouts({ game, questionId, onSetAward }) {
  const say = useSay()
  const played = cardsPlayedOn(game, questionId)
  const payoutCards = played
    .map((held) => ({ held, card: findCard(held.key) }))
    .filter(({ card }) => card && card.payout)

  if (payoutCards.length === 0) return null

  return (
    <Plate className="mb-4 px-3.5 py-3.5">
      <Eyebrow className="mb-2.5 text-dim" size={10} tracking="0.16em">
        Card payouts
      </Eyebrow>

      <ul className="flex flex-col gap-3">
        {payoutCards.map(({ held, card }) => {
          const player = findPlayer(game, held.playerId)
          const decided = held.awardPoints != null

          return (
            <li key={held.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-red">
                <Mark path={card.mark} size={18} boxed={false} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ivory">
                  <span className="font-semibold">{player ? player.displayName : 'Someone'}</span> played{' '}
                  <span className="font-semibold">{say(card.name)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {card.payoutOptions.map((option) => {
                    const selected = held.awardPoints === option.points
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => onSetAward(held.id, option.points)}
                        className={
                          'focus-ring min-h-[44px] border px-3.5 font-body text-sm font-semibold ' +
                          (selected
                            ? 'border-red bg-board-warm text-red'
                            : 'border-line bg-panel text-ivory')
                        }
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {!decided && (
                  <p className="mt-1.5 text-[13px] font-semibold text-red">Not awarded yet</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Plate>
  )
}
