import { useState } from 'react'
import { Card, Eyebrow, BigButton, TextLink, Gloss } from '../ui.jsx'
import { findCard } from '../powerUps.js'
import { activePlayers, cardsPlayedOn } from '../gameHelpers.js'
import PowerCard from './PowerCard.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// YOUR HAND - the card you are holding for this question.
//
// Playing is two taps: pick the card, then confirm. Never one, because a card
// is one-use and is replaced when the next question comes up, so a fumbled
// tap would spend something you cannot get back. Cards that hit another player make you choose
// who before the confirm button will do anything, so it is never ambiguous who
// you aimed at.
//
// ONE CARD PER QUESTION. You can be holding two at once - a dealt card and a
// mercy card from coming last - and nothing used to stop you spending both on
// the same question, which is not the rule. Once you have played one, the rest
// of the hand goes read-only until the next question.
//
// Restyled to the room language.
// ---------------------------------------------------------------------------

export default function PowerUpHand({ game, meId, hand, onPlay }) {
  const say = useSay()
  const [openId, setOpenId] = useState(null)
  const [target, setTarget] = useState(null)

  const myPlay = cardsPlayedOn(game, game.currentQuestionId).find(
    (card) => card.playerId === meId,
  )

  // WHAT YOU JUST SPENT.
  //
  // `handFor` only returns cards still in hand, so the moment one was played
  // this whole panel returned null and the card simply vanished off the
  // player's screen - no confirmation, nothing naming what they had spent,
  // and on a phone no way to check. The audit played a card and could not
  // tell from the screen whether it had worked.
  //
  // A card is one-use and cannot be taken back, so it is worth one line.
  if (!hand || hand.length === 0) {
    if (!myPlay) return null
    const played = findCard(myPlay.key)
    if (!played) return null

    const at = myPlay.targetPlayerId
      ? activePlayers(game).find((player) => player.id === myPlay.targetPlayerId)
      : null

    return (
      <div className="mt-[18px]">
        <Eyebrow className="mb-2.5 text-dim" size={10} tracking="0.16em">
          Your hand · Spent on this question
        </Eyebrow>
        <Card>
          <div className="font-impact text-[17px] uppercase leading-[1.15] text-ivory desktop:text-[20px]">
            {say(played.name)}
            {at ? ' · on ' + at.displayName : ''}
          </div>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-dim desktop:text-[17px]">
            {say(played.description)}
          </p>
          <Gloss className="mt-2.5">
            Played. Nothing else to spend until the next question.
          </Gloss>
        </Card>
      </div>
    )
  }

  const others = activePlayers(game).filter((player) => player.id !== meId)
  const alreadyPlayed = Boolean(myPlay)

  function close() {
    setOpenId(null)
    setTarget(null)
  }

  const open = hand.find((held) => held.id === openId)
  const openCard = open ? findCard(open.key) : null
  const needsTarget = Boolean(openCard && openCard.needsTarget)
  const canPlay = !needsTarget || target !== null

  return (
    <div className="mt-[18px]">
      <Eyebrow className="mb-2.5 text-dim" size={10} tracking="0.16em">
        {alreadyPlayed ? 'Your hand · One card per question' : 'Your hand · Spend one before you answer'}
      </Eyebrow>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
        }}
      >
        {hand.map((held) => {
          const card = findCard(held.key)
          if (!card) return null

          return (
            <PowerCard
              key={held.id}
              card={card}
              selected={held.id === openId}
              // No onClick at all once one is spent, so the card renders as a
              // plain picture rather than a button that looks tappable.
              onClick={
                alreadyPlayed
                  ? undefined
                  : () => {
                      if (held.id === openId) {
                        close()
                      } else {
                        setOpenId(held.id)
                        setTarget(null)
                      }
                    }
              }
            />
          )
        })}
      </div>

      <Gloss className="mt-2.5">
        {alreadyPlayed
          ? 'You have played your card for this question. A new one comes with the next.'
          : 'One card per question. Play it or lose it - the next question deals a new one.'}
      </Gloss>

      {/* The confirm step, shown under the grid rather than inside a card, so
          the card art is never covered by the controls for playing it. */}
      {openCard && !alreadyPlayed && (
        <Card accent className="mt-3">
          <p className="font-impact text-[19px] text-ivory uppercase">Play {say(openCard.name)}?</p>

          {needsTarget && (
            <>
              <p className="mt-2.5 text-[13.5px] font-semibold text-ivory">{say(openCard.targetLabel)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {others.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setTarget(player.id)}
                    className={
                      'focus-ring min-h-[44px] border px-3.5 font-body text-sm font-semibold ' +
                      (target === player.id
                        ? 'border-red bg-board-warm text-red'
                        : 'border-line bg-panel text-ivory')
                    }
                  >
                    {player.displayName}
                  </button>
                ))}
                {others.length === 0 && (
                  <p className="text-sm text-dim">There is nobody else to aim at.</p>
                )}
              </div>
            </>
          )}

          {openCard.needsHost && (
            <p className="mt-2.5 text-sm text-dim">
              {say('{name} will be told you played this, and answers out loud.')}
            </p>
          )}

          {openCard.autoTargetsLeader && (
            <p className="mt-2.5 text-sm text-dim">
              {say(
                'This always hits whoever is currently in the lead. You do not choose, and neither does {name}.',
              )}
            </p>
          )}

          <div className="mt-4">
            <BigButton
              onClick={() => {
                onPlay(open.id, target)
                close()
              }}
              disabled={!canPlay}
            >
              Play it
            </BigButton>
          </div>

          {needsTarget && target === null && others.length > 0 && (
            <p className="mt-2.5 text-sm font-semibold text-red">Pick somebody first.</p>
          )}

          <div className="mt-2.5 text-center">
            <TextLink onClick={close}>Not yet</TextLink>
          </div>
        </Card>
      )}
    </div>
  )
}
