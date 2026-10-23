import { useState, useEffect, useRef } from 'react'
import {
  Screen,
  Clock,
  PlayerTag,
  Card,
  Title,
  Eyebrow,
  Gloss,
  Figure,
  Rule,
  FooterCaption,
  BigButton,
  CountPill,
  ProgressBar,
  Redacted,
  TimeLeft,
  TooSlow,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  categoryPosition,
  answersForQuestion,
  answerFor,
  activePlayers,
  findPlayer,
  badgeNumberFor,
} from '../gameHelpers.js'
import { roundTypeFor } from '../roundTypes.js'
import { identityFor } from '../roundIdentity.js'
import { pickFrom } from '../copy.js'
import { useCountdown } from '../useCountdown.js'
import { currentBadgeFor } from '../badge.js'
import RoundBand from '../components/RoundBand.jsx'
import StakePanel from '../components/StakePanel.jsx'
import TimerControl from '../components/TimerControl.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// THE AUCTION - bidding phase, 3C in the design bundle ("The Payoff").
//
// Players bid points for the exclusive right to answer. They see only the
// TOPIC, never the question, so a bid is a real gamble. Highest bid wins and
// answers alone: right, they gain their bid; wrong, they lose it.
//
// This is the most swingy round in the game. Somebody in last place can bid
// everything and leapfrog the room, which keeps people in it to the end.
//
// It uses the same accent stake panel as the Wager Final, because it is the
// same decision wearing a different name - the bundle's own note on the
// wager screen says as much.
//
// Restyled to the room language. No behaviour changed, only the look.
// ---------------------------------------------------------------------------

// Written states for a player who has not sealed a bid yet, picked from their
// player id so it stays put rather than reshuffling on every render. Never a
// spinner - the design is firm that a waiting state should say something.
const STILL_THINKING = [
  'still doing sums',
  'reading it again',
  'staring at the ceiling',
  'weighing it up',
]

export default function BiddingScreen({
  game,
  isHost,
  meId,
  onSubmitBid,
  onLockBids,
  onStartTimer,
  onExtendTimer,
  onClearTimer,
}) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)
  const ledger = categoryPosition(game)
  const { secondsLeft, expired } = useCountdown(game.timerEndsAt)

  // AUTO-LOCK, host only. Once the timer hits zero, close bidding exactly as
  // if the button had been pressed - sealed bids have no equivalent of "her
  // own answer" to wait on, so nothing else gates it. Declared unconditionally
  // (before the early return below) because a hook cannot live inside an
  // `if`; guarded by `isHost` inside the effect instead.
  const autoLocked = useRef(false)
  useEffect(() => {
    if (!isHost || !expired || autoLocked.current) return
    autoLocked.current = true
    onLockBids()
  }, [isHost, expired, onLockBids])

  if (!question) {
    return (
      <Screen fixed centerY roomCode={game.roomCode}>
        <p className="text-center text-[15px] desktop:text-[19px] text-dim">This question is missing.</p>
      </Screen>
    )
  }

  const roundType = roundTypeFor(question)
  const identity = identityFor(roundType.key)
  const answers = answersForQuestion(game, question.id)
  const bidsIn = answers.filter((answer) => typeof answer.bid === 'number').length
  const players = activePlayers(game)
  const playerCount = players.length

  // --- Host view: watch the bids come in -----------------------------------
  if (isHost) {
    return (
      <Screen
        fixed
        status={{ left: 'The payoff · bids in', right: 'Case ' + game.roomCode + ' · host view' }}
        band={<RoundBand roundType={roundType} position={position} ledger={ledger.number - 1} secondsLeft={secondsLeft} />}
        footer={{ left: 'Sealed until you say so', right: game.roomCode }}
      >

        {/* No gap beside the rule. A 40px gap AND a 2px border between two
            columns is the thing the house rules call "two phone screens side by
            side" - regions meet, and the separation is the rule plus each
            column's own padding. The left column also centres itself: it holds
            the topic and the question the host reads out, which is four lines,
            and pinned to the top of an 830px window it left most of the column
            bare. */}
        <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_360px]">
          <div className="flex flex-col desktop:justify-center desktop:pr-9">
            <Card accent className="mt-4 desktop:mt-0">
              <Eyebrow className="text-red" size={9.5} tracking="0.18em">
                The topic
              </Eyebrow>
              <Title size="sm" className="mt-1.5">
                {question.topic || 'General'}
              </Title>

              <Rule tone="hairline" className="my-3.5" />
              <Eyebrow className="text-dim" size={9.5} tracking="0.18em">
                Only you can see this
              </Eyebrow>
              <p className="mt-1.5 text-[16px] desktop:text-[20px] text-ivory">{question.text}</p>
            </Card>

            <TimerControl
              secondsLeft={secondsLeft}
              onStart={onStartTimer}
              onExtend={onExtendTimer}
              onClear={onClearTimer}
            />
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col desktop:mt-4 desktop:border-l-2 desktop:border-rule desktop:pl-9">
            <Card>
              <div className="flex items-baseline gap-2.5">
                <Figure size={42} tone="gain">
                  {bidsIn}
                </Figure>
                <span className="font-mono text-[17px] desktop:text-[22px] text-dim">/ {playerCount}</span>
                <Eyebrow className="ml-auto text-dim" size={9.5} tracking="0.16em">
                  Bids sealed
                </Eyebrow>
              </div>
              <ProgressBar done={bidsIn} total={playerCount} />
            </Card>

            <Card className="mt-3">
              <div className="flex justify-between border-b border-line pb-2">
                <Eyebrow className="text-dim" size={9.5} tracking="0.14em">
                  Detective
                </Eyebrow>
                <Eyebrow className="text-dim" size={9.5} tracking="0.14em">
                  Stake
                </Eyebrow>
              </div>
              {players.map((player) => {
                const answer = answerFor(game, question.id, player.id)
                const sealed = answer && typeof answer.bid === 'number'
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between border-b border-rule py-[10px] last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] desktop:text-[19px] text-ivory">
                      {player.displayName}
                    </span>
                    {sealed ? (
                      <Redacted className="font-mono text-[13px] desktop:text-[17px] text-red">
                        {answer.bid} pts
                      </Redacted>
                    ) : (
                      <span className="font-mono text-[12px] desktop:text-[15px] text-dim italic">
                        {say(pickFrom(STILL_THINKING, player.id))}
                      </span>
                    )}
                  </div>
                )
              })}
            </Card>

            <div className="mt-3">
              <BigButton onClick={onLockBids} disabled={bidsIn === 0}>
                Close bidding
              </BigButton>
            </div>
            {bidsIn === 0 && (
              <p className="mt-2.5 text-center text-[13px] desktop:text-[17px] font-bold text-red">
                Nobody has bid yet.
              </p>
            )}

            <FooterCaption className="reserve-exit mt-3 text-center">
              {say(identity.oneLiner)}
            </FooterCaption>
          </div>
        </div>
      </Screen>
    )
  }

  // --- Player view ---------------------------------------------------------
  const me = findPlayer(game, meId)
  const myAnswer = answerFor(game, question.id, meId)
  const alreadyBid = myAnswer && typeof myAnswer.bid === 'number'
  const badge = currentBadgeFor(game, meId)
  const badgeNo = badgeNumberFor(game, meId)

  if (expired && !alreadyBid) {
    return <TooSlow detail="The bidding closed while you were still deciding." />
  }

  if (alreadyBid) {
    return (
      <Screen
        fixed
        status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
        band={<RoundBand roundType={roundType} position={position} ledger={ledger.number - 1} secondsLeft={secondsLeft} />}
        footer={{ left: 'Your bid is sealed', right: game.roomCode }}
      >

        <Card accent className="mt-6 text-center">
          {/* Somebody who bid nothing chose to sit this one out, so telling them
              their bid is placed and to wait and see if they won reads as the
              app not having noticed. */}
          <Eyebrow className="text-dim" size={9.5} tracking="0.18em">
            {myAnswer.bid === 0 ? 'You passed' : 'Bid sealed'}
          </Eyebrow>
          <Figure size={56} tone="gain" className="mt-2 justify-center">
            {myAnswer.bid}
          </Figure>
          <Eyebrow className="mt-1 text-dim" size={9.5} tracking="0.18em">
            Points bid
          </Eyebrow>
          <p className="mt-4 text-[15px] desktop:text-[19px] text-dim">
            {myAnswer.bid === 0
              ? 'Sitting this one out. Waiting for the bidding to close…'
              : 'Waiting to see if you won the auction…'}
          </p>
        </Card>

        <FooterCaption className="reserve-exit mt-auto pt-6 text-center">
          {say(identity.oneLiner)}
        </FooterCaption>
      </Screen>
    )
  }

  return (
    <BidForm
      game={game}
      question={question}
      roundType={roundType}
      identity={identity}
      position={position}
      ledger={ledger}
      me={me}
      meId={meId}
      roomCode={game.roomCode}
      onSubmitBid={onSubmitBid}
      badge={badge}
      badgeNo={badgeNo}
      secondsLeft={secondsLeft}
    />
  )
}

function BidForm({
  game,
  question,
  roundType,
  identity,
  position,
  ledger,
  me,
  meId,
  roomCode,
  onSubmitBid,
  badge,
  badgeNo,
  secondsLeft,
}) {
  const say = useSay()
  const maxBid = me ? Math.max(0, me.score) : 0
  const [amount, setAmount] = useState(0)

  // EVERYONE ELSE'S BID - redacted presence, not amounts. Per bundle 2's own
  // "Bidding, player" frame: a solid bar per other player once they have
  // sealed theirs, so you can feel the room committing without learning what
  // anyone actually staked (the amount only ever shows to the host, sealed,
  // in the ledger).
  const others = activePlayers(game).filter((player) => player.id !== meId)
  const sealedIds = new Set(
    answersForQuestion(game, question.id)
      .filter((answer) => typeof answer.bid === 'number')
      .map((answer) => answer.playerId),
  )

  return (
    <Screen
      fixed
      scroll
      status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
      band={<RoundBand roundType={roundType} position={position} ledger={ledger.number - 1} secondsLeft={secondsLeft} />}
      footer={{ left: 'There is no refund and no sympathy', right: roomCode }}
    >

      {/* Same as the host view above: the rule and the columns' own padding do
          the separating, so no gap beside the border. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-1 flex-col desktop:pr-9">
          <Eyebrow className="mt-5 text-dim" size={10} tracking="0.18em">
            The topic
          </Eyebrow>
          <Title size="sm" className="mt-1.5">
            {question.topic || 'General'}
          </Title>
          <Gloss className="mt-2.5">
            That is all you get. The question stays shut until the bidding closes.
          </Gloss>

          <div className="mt-4">
            <StakePanel
              label="What is it worth?"
              amount={amount}
              max={maxBid}
              onChange={setAmount}
              footnote="Win the bid and answer right, you gain it. Answer wrong, you lose it anyway."
            />
          </div>

          <div className="mt-auto flex flex-col items-center gap-3 pt-4">
            {secondsLeft !== null && <TimeLeft secondsLeft={secondsLeft} className="w-full" />}
            <BigButton onClick={() => onSubmitBid(amount)}>
              {amount === 0 ? 'Pass on this one' : identity.cta}
            </BigButton>

            <CountPill>Highest bid answers alone</CountPill>

            <FooterCaption className="reserve-exit text-center">{say(identity.oneLiner)}</FooterCaption>
          </div>
        </div>

        {others.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5 desktop:mt-16 desktop:border-l-2 desktop:border-rule desktop:pl-8">
            <Eyebrow className="text-dim" size={9.5} tracking="0.16em">
              Everyone else&rsquo;s bid
            </Eyebrow>
            {others.map((player) => (
              <div key={player.id} className="flex items-center gap-3">
                <span className="w-[74px] shrink-0 truncate font-mono text-[12px] desktop:text-[15px] text-dim">
                  {player.displayName}
                </span>
                {sealedIds.has(player.id) ? (
                  <Redacted className="h-[18px] max-w-[90px] flex-1" />
                ) : (
                  <span className="font-mono text-[11px] desktop:text-[14px] text-dim/60 italic">still deciding</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}
