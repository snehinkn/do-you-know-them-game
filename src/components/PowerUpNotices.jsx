import { Plate, Eyebrow, Mark } from '../ui.jsx'
import { findCard } from '../powerUps.js'
import { findPlayer, cardsPlayedOn } from '../gameHelpers.js'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// WHAT GOT PLAYED - host only.
//
// Two jobs, and the first one matters most:
//
//   1. Some cards need the guest of honour to DO something out loud - give a
//      hint, say
//      warm or cold, award points on a whim. Those are pulled to the top in
//      loud red, because a missed hint is a player sitting there waiting.
//
//   2. Everything else is context, so when the scores come out strangely she
//      can see why rather than assuming the app is broken.
//
// WHICH CARDS COUNT AS "ACT NOW" CHANGES WITH THE SCREEN (`phase`):
//
//   'question' (QuestionScreenHost) - every needsHost card is loud. This is
//   the only moment a hint or "warm/cold" actually still matters - said after
//   the player has already answered, it is useless.
//
//   'judging' (JudgingScreen) - answers are locked, so a hint is already too
//   late. Only PAYOUT cards (Wildcard, Bonus Question, Vote of Confidence)
//   stay loud, because their decision is still genuinely pending - it gets
//   made on the reveal screen. A plain needsHost card (Ask the Guest of
//   Honour, Warm or Cold, Hint Token) whose moment has passed moves to the
//   quiet summary instead of repeating a prompt she can no longer act on.
//
//   'reveal' (RevealScreen) - everything is history. The payout buttons
//   themselves live in `CardPayouts.jsx` right below this, so nothing here
//   needs to shout any more.
//
// Restyled to the room language.
// ---------------------------------------------------------------------------

export default function PowerUpNotices({ game, questionId, phase = 'question' }) {
  const say = useSay()
  const played = cardsPlayedOn(game, questionId)
  if (played.length === 0) return null

  const nameOf = (playerId) => {
    const player = findPlayer(game, playerId)
    return player ? player.displayName : 'Someone'
  }

  const stillActionable = (held, card) => {
    if (!card.needsHost) return false
    if (phase === 'question') return true
    if (phase === 'judging') return Boolean(card.payout) && held.awardPoints == null
    return false // 'reveal'
  }

  const needsHer = played.filter((c) => {
    const card = findCard(c.key)
    return card && stillActionable(c, card)
  })
  const rest = played.filter((c) => {
    const card = findCard(c.key)
    return card && !stillActionable(c, card)
  })

  return (
    <>
      {/* Things she has to act on, right now. */}
      {needsHer.map((held) => {
        const card = findCard(held.key)
        return (
          <div
            key={held.id}
            className="mb-3 flex items-start gap-3 border border-red bg-board-warm p-3.5"
          >
            <Mark path={card.mark} band="border-red text-red" />
            <div className="min-w-0 flex-1">
              <Eyebrow className="text-red" size={10} tracking="0.18em">
                Over to you
              </Eyebrow>
              <p className="mt-1 font-impact text-[18px] leading-[1.15] text-ivory uppercase">
                {nameOf(held.playerId)} played {say(card.name)}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ivory">{say(card.hostPrompt)}</p>
            </div>
          </div>
        )
      })}

      {/* Everything else, quietly. */}
      {rest.length > 0 && (
        <Plate className="mb-4 px-3.5 py-3.5">
          <Eyebrow className="mb-2.5 text-dim" size={10} tracking="0.16em">
            Cards played
          </Eyebrow>
          <ul className="flex flex-col gap-2.5">
            {rest.map((held) => {
              const card = findCard(held.key)
              return (
                <li key={held.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-red">
                    <Mark path={card.mark} size={18} boxed={false} />
                  </span>
                  <span className="min-w-0 text-[14px] text-ivory">
                    <span className="font-semibold">{nameOf(held.playerId)}</span> played{' '}
                    <span className="font-semibold">{say(card.name)}</span>
                    {held.targetPlayerId && <> on {nameOf(held.targetPlayerId)}</>}
                    <span className="block text-dim">{say(card.description)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Plate>
      )}
    </>
  )
}
