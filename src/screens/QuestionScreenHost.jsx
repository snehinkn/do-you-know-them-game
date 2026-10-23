import { useState, useEffect, useRef } from 'react'
import {
  Screen,
  Region,
  Card,
  Button,
  Title,
  Eyebrow,
  Gloss,
  Figure,
  FooterCaption,
  ErrorBanner,
  TextLink,
  ProgressBar,
  EmptySlot,
  LiveNote,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  categoryPosition,
  answersForQuestion,
  activePlayers,
  cardsPlayedOn,
} from '../gameHelpers.js'
import { roundTypeFor, JUDGE_MODES, auctionWinners } from '../roundTypes.js'
import { identityFor, ledgerNumeral } from '../roundIdentity.js'
import { useCountdown } from '../useCountdown.js'
import RoundBand from '../components/RoundBand.jsx'
import RankInput from '../components/RankInput.jsx'
import PowerUpNotices from '../components/PowerUpNotices.jsx'
import TimerControl from '../components/TimerControl.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// SCREEN 5 - Question screen, host's view.
//
// The host watches the answer count climb, then locks. They do NOT see the
// answers themselves until she locks, which keeps the reveal fun for her too.
//
// On a ranking round she is not a spectator: she builds her own order at the
// same time as everyone else, and that order becomes the answer key.
//
// Restyled to match the rest of the app (was still in the pre-redesign look).
// No behaviour changed, only the look.
// ---------------------------------------------------------------------------

export default function QuestionScreenHost({
  game,
  onLockAnswers,
  onSkipQuestion,
  onSetTrueOrder,
  onSetTrueNumber,
  onSetTrueAnswer,
  onStartTimer,
  onExtendTimer,
  onClearTimer,
}) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)
  const ledger = categoryPosition(game)
  const { secondsLeft, expired } = useCountdown(game.timerEndsAt)

  // AUTO-LOCK. The whole point of a host-started timer is that it moves the
  // round on without the host having to eyeball who is still out - so the
  // moment it hits zero, lock answers exactly as if the button had been
  // pressed. Declared unconditionally, BEFORE the early return just below -
  // a hook cannot live inside an `if` or after one - so it recomputes its own
  // small "is she still owed an answer" check from the raw question rather
  // than reusing `waitingOnHer` further down, which does not exist yet here.
  // Guarded so it can only ever fire once per question (this component is
  // remounted fresh for every question - see the `key` on it in App.jsx - so
  // the ref needs no manual reset).
  const autoLocked = useRef(false)
  useEffect(() => {
    if (!question || !expired || autoLocked.current) return

    const roundType = roundTypeFor(question)
    const waitingOnHer =
      (roundType.judgeMode === JUDGE_MODES.AUTO_MATCH && !(question.trueOrder && question.trueOrder.length > 0)) ||
      (roundType.judgeMode === JUDGE_MODES.AUTO && (question.trueNumber === null || question.trueNumber === undefined)) ||
      (roundType.needsVoting && !(question.trueAnswer && question.trueAnswer.trim() !== ''))
    if (waitingOnHer) return

    autoLocked.current = true
    onLockAnswers()
  }, [question, expired, onLockAnswers])

  if (!question) {
    return (
      <Screen fixed centerY roomCode={game.roomCode}>
        <ErrorBanner message="This question is missing. Skip it to move on." />
        <Button onClick={onSkipQuestion}>Skip this question</Button>
      </Screen>
    )
  }

  const roundType = roundTypeFor(question)
  const identity = identityFor(roundType.key)
  const answers = answersForQuestion(game, question.id)
  const answeredCount = answers.filter((answer) => answer.submitted).length

  // Levelling sits its target out entirely - they get no answer box - so the
  // host must not sit here waiting on an answer that is never coming.
  const leveledOutId = cardsPlayedOn(game, question.id).find(
    (card) => card.key === 'levelling',
  )?.targetPlayerId

  // In the Auction only the winning bidder is allowed to answer at all, so the
  // count and the "still waiting on" line have to be about THEM. Counting
  // everyone meant this screen sat on "0 of 4, still waiting on Aisha, Rohan,
  // Meera, Dev" while three of those four were looking at a "you were outbid"
  // screen, and it never once said everyone had answered.
  const expectedPlayers = (
    roundType.needsBidding
      ? auctionWinners(answers)
          .map((answer) => activePlayers(game).find((player) => player.id === answer.playerId))
          .filter(Boolean)
      : activePlayers(game)
  ).filter((player) => player.id !== leveledOutId)

  const totalPlayers = expectedPlayers.length
  const everyoneAnswered = answeredCount >= totalPlayers && totalPlayers > 0
  // Levelling excludes its target from expectedPlayers, same as the Auction
  // already excludes non-bidders. If the Auction's sole winning bidder is
  // also the player Levelling just sat out, that leaves nobody left who is
  // even allowed to answer - and without this, "Lock answers" stayed
  // disabled forever, because it only ever turned on once answeredCount rose
  // above zero, which could now never happen on this question.
  const nobodyCanAnswer = totalPlayers === 0

  const playersWhoAnswered = answers.filter((a) => a.submitted).map((answer) => answer.playerId)
  const waitingFor = expectedPlayers.filter((player) => !playersWhoAnswered.includes(player.id))

  // On these rounds she plays too, and her own answer becomes the answer key.
  const needsHerOrder = roundType.judgeMode === JUDGE_MODES.AUTO_MATCH
  const herOrderIsSet = Boolean(question.trueOrder && question.trueOrder.length > 0)

  const needsHerNumber = roundType.judgeMode === JUDGE_MODES.AUTO
  const herNumberIsSet = question.trueNumber !== null && question.trueNumber !== undefined

  const needsHerTruth = roundType.needsVoting
  const herTruthIsSet = Boolean(question.trueAnswer && question.trueAnswer.trim() !== '')

  const waitingOnHer =
    (needsHerOrder && !herOrderIsSet) ||
    (needsHerNumber && !herNumberIsSet) ||
    (needsHerTruth && !herTruthIsSet)

  return (
    <Screen
      fixed
      pad={false}
      status={false}
      band={
        <RoundBand
          roundType={roundType}
          position={position}
          ledger={ledger.number - 1}
          secondsLeft={secondsLeft}
          right={
            secondsLeft === null || secondsLeft === undefined
              ? 'Q' + position.number + ' / ' + position.total + ' · host view'
              : undefined
          }
        />
      }
      footer={{
        left: 'Ledger ' + ledgerNumeral(ledger.number - 1) + ' of ' + ledgerNumeral(ledger.total - 1) + ' · ' + say(roundType.label),
        right: game.roomCode,
      }}
    >
      {/* Everything the host reads and fills in on the left; the live count and
          the button that actually moves the game on stay together on the right,
          so the one thing she is watching (how many are still out) sits right
          next to the one thing she can do about it. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_400px]">
        <Region edge="right" className="min-h-0 justify-between gap-5">
          {/* Not flex-1/min-h-0/overflow-y-auto - see the matching note in
              QuestionScreenPlayer.jsx. The question takes its natural height
              rather than being squeezed by the timer control below it. */}
          <div className="flex flex-col gap-4">
            <Eyebrow className="shrink-0 text-red" size={10} tracking="0.26em">
              Read this out
            </Eyebrow>

            {/* The question sizes itself from its own length - see typeFit.js.
                A host-written question of any length wraps downwards and
                shrinks to fit rather than running off the bottom of the
                phone. */}
            <Title>{question.text}</Title>

            <Gloss>{say(roundType.hostHint)}</Gloss>

            <PowerUpNotices game={game} questionId={question.id} />

            {/* Fibbage: her real answer, written while everyone else writes lies. */}
            {needsHerTruth && (
              <HostTruthPanel
                question={question}
                onSetTrueAnswer={onSetTrueAnswer}
                isSet={herTruthIsSet}
              />
            )}

            {/* Ranking rounds: she plays too, and her order is the answer key. */}
            {needsHerOrder && (
              <HostRankPanel
                question={question}
                onSetTrueOrder={onSetTrueOrder}
                isSet={herOrderIsSet}
              />
            )}

            {/* Closest Guess: her own number is the answer key. */}
            {needsHerNumber && (
              <HostNumberPanel
                question={question}
                onSetTrueNumber={onSetTrueNumber}
                isSet={herNumberIsSet}
              />
            )}
          </div>

          <div className="shrink-0 border-t-2 border-rule pt-4">
            <TimerControl
              secondsLeft={secondsLeft}
              onStart={onStartTimer}
              onExtend={(seconds) => onExtendTimer(seconds)}
              onClear={onClearTimer}
            />
          </div>
        </Region>

        <Region className="min-h-0 justify-between gap-5">
          <div className="flex min-h-0 flex-col gap-4">
            <Card>
              <div className="flex items-baseline gap-2.5">
                <Figure size={44} tone="red">
                  {answeredCount}
                </Figure>
                <span className="font-mono text-[16px] text-dim desktop:text-[18px]">
                  / {totalPlayers}
                </span>
                <Eyebrow className="ml-auto shrink-0 text-dim" size={9.5} tracking="0.2em">
                  {roundType.hasWager ? 'Bets in' : 'Statements taken'}
                </Eyebrow>
              </div>

              <ProgressBar done={answeredCount} total={totalPlayers} className="mt-3.5" />

              {/* Who is still out. Written names rather than a spinner - the
                  design is firm that a waiting state should say WHO it is
                  waiting on. */}
              {waitingFor.length > 0 && (
                <p
                  className="mt-3 font-mono text-[10.5px] uppercase text-warm desktop:text-[11px]"
                  style={{ letterSpacing: '0.16em' }}
                >
                  Still out: {waitingFor.map((player) => player.displayName).join(', ')}
                </p>
              )}
              {everyoneAnswered && (
                <p
                  className="mt-3 font-mono text-[10.5px] uppercase text-red-bright desktop:text-[11px]"
                  style={{ letterSpacing: '0.16em' }}
                >
                  Everyone has answered.
                </p>
              )}
              {/* Two different ways to end up with nobody able to answer, and
                  they need different explanations. Blaming Levelling when the
                  real reason is that nobody bid sent the host looking for a card
                  that was never played - and nobody bidding is the likely one,
                  since a nervous room bids nothing. */}
              {nobodyCanAnswer && (
                <p className="mt-2.5 font-body text-[13px] text-ivory desktop:text-[15px]">
                  {roundType.needsBidding && !leveledOutId
                    ? 'Nobody bid, so nobody has bought the right to answer. Move on - no points change hands.'
                    : 'Nobody can answer this one - Levelling sat out the only player who could.'}
                </p>
              )}
            </Card>

            {/* The slots the design draws for statements as they land. Nothing
                is revealed - the host does not see an answer until she locks,
                which keeps the reveal fun for her too - so a filled slot says
                only that one arrived. */}
            {!nobodyCanAnswer && totalPlayers > 0 && (
              <div className="hidden flex-col gap-2 desktop:flex">
                <Eyebrow className="shrink-0 text-dim" size={10} tracking="0.24em">
                  Filed so far
                </Eyebrow>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: Math.min(totalPlayers, 6) }, (_, index) =>
                    index < answeredCount ? (
                      <div
                        key={index}
                        className="flex h-[56px] shrink-0 items-center justify-center border-2
                                   border-line bg-panel font-mono text-[10px] font-bold uppercase
                                   text-red-bright"
                        style={{ letterSpacing: '0.2em' }}
                      >
                        Statement filed
                      </div>
                    ) : (
                      <EmptySlot
                        key={index}
                        label="No statement yet"
                        className="h-[56px] shrink-0"
                      />
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3.5">
            <Button
              onClick={onLockAnswers}
              disabled={(answeredCount === 0 && !nobodyCanAnswer) || waitingOnHer}
            >
              {nobodyCanAnswer
                ? 'Continue - nobody could answer'
                : roundType.needsVoting
                  ? 'Lock answers and open the vote'
                  : roundType.judgeMode === JUDGE_MODES.SCORE_EACH
                    ? 'Lock answers and start scoring'
                    : 'Lock answers and see results'}
            </Button>

            {waitingOnHer && answeredCount > 0 && (
              <LiveNote>
                Give your own answer first, so there is something to score against
              </LiveNote>
            )}

            <div className="flex items-center justify-between gap-3">
              <FooterCaption className="min-w-0 flex-1">
                {answeredCount === 0 && !nobodyCanAnswer
                  ? 'Nobody has answered yet'
                  : say(identity.oneLiner)}
              </FooterCaption>
              <TextLink onClick={onSkipQuestion} className="shrink-0">
                Skip this question
              </TextLink>
            </div>
          </div>
        </Region>
      </div>
    </Screen>
  )
}

// The real answer for a Fibbage question. The host writes it at the same time
// as everyone writes their lies, so there is nothing to prepare in advance.
//
// The one thing to watch: if her answer is noticeably longer or more detailed
// than the lies, it gives itself away. Hence the nudge to keep it short.
function HostTruthPanel({ question, onSetTrueAnswer, isSet }) {
  const [draft, setDraft] = useState('')

  if (isSet) {
    return (
      <Card accent className="mt-3">
        <Eyebrow className="text-red" size={10} tracking="0.18em">
          The real answer
        </Eyebrow>
        <p className="mt-1.5 text-[19px] desktop:text-[24px] text-ivory">{question.trueAnswer}</p>
        <p className="mt-2 text-[13px] desktop:text-[17px] text-dim">
          This gets shuffled in with their lies. Only you can see it.
        </p>
        <div className="mt-2 text-center">
          <TextLink onClick={() => onSetTrueAnswer(null)}>Change it</TextLink>
        </div>
      </Card>
    )
  }

  function save() {
    const clean = draft.trim()
    if (clean === '') return
    onSetTrueAnswer(clean)
  }

  return (
    <Card accent className="mt-3">
      <Eyebrow className="text-red" size={10} tracking="0.18em">
        Your turn first
      </Eyebrow>
      <p className="mt-1.5 text-[13px] desktop:text-[17px] text-dim">
        Keep it short, roughly the length of a lie. A long, detailed answer stands out and gives
        the game away.
      </p>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save()
        }}
        maxLength={80}
        placeholder="The truth, in a few words..."
        className="focus-ring caret-red mt-2.5 h-[54px] w-full border-2 border-line
                   bg-board px-3.5 text-[17px] desktop:text-[22px] text-ivory placeholder:text-dim/45"
      />
      <div className="mt-2.5">
        <Button onClick={save}>Lock in the truth</Button>
      </div>
    </Card>
  )
}

// The host's own number. Whoever guesses closest to THAT answer scores, which
// means she needs no prep and we can ask opinion questions that have no
// external right answer.
function HostNumberPanel({ question, onSetTrueNumber, isSet }) {
  const [draft, setDraft] = useState('')

  if (isSet) {
    return (
      <Card accent className="mt-3">
        <Eyebrow className="text-red" size={10} tracking="0.18em">
          Your answer
        </Eyebrow>
        <Figure size={46} tone="gain" className="mt-2 text-center">
          {question.trueNumber}
        </Figure>
        <div className="mt-2 text-center">
          <TextLink onClick={() => onSetTrueNumber(null)}>Change my answer</TextLink>
        </div>
      </Card>
    )
  }

  function save() {
    const value = Number(draft.trim())
    if (draft.trim() === '' || Number.isNaN(value)) return
    onSetTrueNumber(value)
  }

  return (
    <Card accent className="mt-3">
      <Eyebrow className="text-red" size={10} tracking="0.18em">
        Your turn first
      </Eyebrow>
      <p className="mt-1.5 text-[13px] desktop:text-[17px] text-dim">
        Whatever you say is the right answer. Closest guesses to yours take the points.
      </p>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save()
        }}
        placeholder="0"
        className="focus-ring caret-red mt-2.5 h-[62px] w-full border-2 border-line
                   bg-board px-4 text-center font-mono text-[34px] desktop:text-[44px] text-ivory
                   placeholder:text-dim/40"
      />
      <div className="mt-2.5">
        <Button onClick={save}>Lock in my answer</Button>
      </div>
    </Card>
  )
}

// The host's own ranking. This becomes the answer key, so nobody has to be
// judged one at a time.
function HostRankPanel({ question, onSetTrueOrder, isSet }) {
  const [order, setOrder] = useState(() => question.trueOrder || question.items || [])

  if (isSet) {
    return (
      <Card accent className="mt-3">
        <Eyebrow className="text-red" size={10} tracking="0.18em">
          Your order is locked in
        </Eyebrow>
        <ol className="mt-2.5 flex flex-col gap-1.5">
          {(question.trueOrder || []).map((item, index) => (
            <li
              key={item}
              className="flex min-h-[44px] items-center gap-3 border-2 border-line px-3 py-2"
            >
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center bg-red font-impact text-[13px] desktop:text-[17px] text-bone">
                {index + 1}
              </span>
              <span className="min-w-0 text-[15px] desktop:text-[19px] text-ivory">{item}</span>
            </li>
          ))}
        </ol>
        <div className="mt-2.5 text-center">
          <TextLink onClick={() => onSetTrueOrder(null)}>Change my order</TextLink>
        </div>
      </Card>
    )
  }

  return (
    <Card accent className="mt-3">
      <Eyebrow className="text-red" size={10} tracking="0.18em">
        Your turn first
      </Eyebrow>
      <p className="mt-1.5 text-[13px] desktop:text-[17px] text-dim">
        Put these in your real order. Everyone gets scored on how close they got to this.
      </p>
      <div className="mt-2.5">
        <RankInput items={order} onChange={setOrder} />
      </div>
      <div className="mt-3">
        <Button onClick={() => onSetTrueOrder(order)}>Lock in my order</Button>
      </div>
    </Card>
  )
}
