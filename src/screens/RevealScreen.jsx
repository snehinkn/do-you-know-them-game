import {
  Screen,
  Clock,
  PlayerTag,
  Plate,
  PanelHeading,
  CountPill,
  BigButton,
  OneLiner,
  ErrorBanner,
  Eyebrow,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  answersForQuestion,
  answerFor,
  votesForQuestion,
  voteFor,
  findPlayer,
  rankedPlayers,
  isLastQuestionInCategory,
  effectiveScoring,
  pointsToScore,
  badgeNumberFor,
} from '../gameHelpers.js'
import {
  roundTypeFor,
  JUDGE_MODES,
  VERDICTS,
  VERDICT_LABELS,
  TRUTH_OPTION_ID,
  voteMapFor,
  truthOptionIdFrom,
  verdictFromPoints,
} from '../roundTypes.js'
import { identityFor } from '../roundIdentity.js'
import { currentBadgeFor } from '../badge.js'
import RoundBand from '../components/RoundBand.jsx'
import ScoreAdjuster from '../components/ScoreAdjuster.jsx'
import PowerUpNotices from '../components/PowerUpNotices.jsx'
import CardPayouts from '../components/CardPayouts.jsx'
import Standings from '../components/Standings.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// THE UNSEALING - "here is how you did". 3F in the design bundle.
//
// Shown after every single question, so it is the screen players see more
// than any other. It wears the same round band as the question it is
// answering, so a question and its result read as one thing rather than two.
//
// The wording changes per round, because "correct" means something different
// when you were writing a lie or pitching a night out at somebody.
//
// A gain is red, a loss is grey - the house rule, held even on the one screen
// that most wants a second colour. `Redacted` gets its real job here too: the
// answer key was already visible during the question in a few rounds, but
// this is the screen where a genuinely hidden thing (the fibbage truth, in
// spirit) gets its wipe.
//
// Restyled to the room language, and folded three near-identical leaderboard
// renderers (this file's own, the round-results screen's, the wager
// standings') into the one shared `Standings` component.
// ---------------------------------------------------------------------------

const TONES = {
  good: 'border-red bg-red text-bone',
  middling: 'border-red bg-board-warm text-red',
  bad: 'border-line bg-panel text-dim',
}

export default function RevealScreen({
  game,
  isHost,
  meId,
  onNextQuestion,
  onSetPowerUpAward,
  onRemovePlayer,
}) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)
  const lastInCategory = isLastQuestionInCategory(game)

  if (!question) {
    return (
      <Screen maxWidth={620} centerY={false} roomCode={game.roomCode}>
        <Plate hero className="p-5">
          <ErrorBanner message="This question is missing. Continue to the next one." />
          {isHost && (
            <div className="mt-4">
              <BigButton onClick={onNextQuestion}>Continue</BigButton>
            </div>
          )}
        </Plate>
      </Screen>
    )
  }

  const roundType = roundTypeFor(question)
  const identity = identityFor(roundType.key)
  const answers = answersForQuestion(game, question.id)
  const myAnswer = answerFor(game, question.id, meId)

  // The points as they actually landed, with any power-up already applied. This
  // screen used to print the raw verdict, so somebody who played "double your
  // points" read "+2" while their total went up by 4.
  // Both halves of the scoring walk: the points, and the STAKES capped to what
  // each player could actually afford. Without the capped figure this screen
  // printed the raw bet - so a player who staked more than they held showed
  // "+999" here while the standings beside it correctly moved by 1.
  const { effective, stakes } = effectiveScoring(game)

  const badge = !isHost ? currentBadgeFor(game, meId) : null
  const badgeNo = !isHost ? badgeNumberFor(game, meId) : null

  return (
    <Screen
      fixed
      scroll
      status={
        isHost
          ? { left: say(roundType.label) + ' · the verdict', right: 'Case ' + game.roomCode }
          : { left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }
      }
      band={<RoundBand roundType={roundType} position={position} />}
      footer={{ left: 'Points are on the record', right: game.roomCode }}
    >

      {/* The standings move into a right-hand rail on desktop rather than
          trailing at the foot of a long single column - it is the one
          panel on this screen that stands alone regardless of round type,
          so it is the safe piece to pull out rather than restructuring the
          fibbage/non-fibbage branches themselves. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_380px] desktop:items-stretch">
      <div className="shrink-0 desktop:pr-9">
      <Plate hero className="mt-[18px] px-[18px] py-5">
        <p
          className="font-impact leading-[1.1] text-ivory uppercase"
          style={{ fontSize: 'clamp(21px, 3.8cqw, 27px)' }}
        >
          {question.text}
        </p>

        {/* THE ANSWER KEY, shown to everyone.
            Whatever the guest of honour said is the right answer in these
            rounds, so it goes here on the shared panel rather than being
            something only the host can see. A player who is only told their
            own score never finds out what the answer actually was, which is
            the part everybody in the room wants to hear. */}
        {roundType.judgeMode === JUDGE_MODES.AUTO && (
          <p className="mt-3 border-t border-dashed border-line pt-3 text-[14px] desktop:text-[18px] text-dim">
            {say('{name} said')}{' '}
            <span className="font-mono text-[20px] desktop:text-[26px] text-red tabular-nums">
              {question.trueNumber}
            </span>
          </p>
        )}
        {roundType.judgeMode === JUDGE_MODES.AUTO_MATCH && (question.trueOrder || []).length > 0 && (
          <div className="mt-3 border-t border-dashed border-line pt-3">
            <Eyebrow className="text-dim" size={10} tracking="0.16em">
              {say("{name}'s order")}
            </Eyebrow>
            <ol className="mt-2.5 flex flex-col gap-1.5">
              {question.trueOrder.map((item, index) => (
                <li
                  key={item}
                  className="flex min-h-[40px] items-center gap-3 border border-line bg-panel px-3 py-2"
                >
                  <span className="grid h-[24px] w-[24px] shrink-0 place-items-center border border-red font-mono text-[12px] desktop:text-[15px] text-red">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] desktop:text-[18px] text-ivory">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {/* Host only. A player gets the same sentence a few lines further down,
            inside their own "you found it / you fell for it" verdict panel, and
            printing it in both places put it twice on every player's screen,
            one line under the other. The host has no verdict panel, so this is
            where they read it. */}
        {roundType.needsVoting && isHost && (
          <p className="mt-3 border-t border-dashed border-line pt-3 text-[14px] desktop:text-[18px] text-dim">
            The real answer was <span className="font-semibold text-red">{question.trueAnswer}</span>
          </p>
        )}
      </Plate>

      {/* Any cards played, so a score that looks wrong has a visible reason.
          Without this, "she gave me 2 but I only got 1" reads as a bug. */}
      <div className="mt-[18px]">
        <PowerUpNotices game={game} questionId={question.id} phase="reveal" />
      </div>

      {/* Wildcard, Bonus Question and Vote of Confidence need the judge to pick
          an amount before their points exist anywhere. */}
      {isHost && (
        <div className="mt-[18px]">
          <CardPayouts game={game} questionId={question.id} onSetAward={onSetPowerUpAward} />
        </div>
      )}

      {/* The Alibi gets its own breakdown of who fooled whom. Every other
          round used to split here: the host saw everyone's answers, a player
          saw only their own. Now a player gets their own big personal verdict
          first - that moment isn't lost - and then the same full list of
          everyone's answers the host has always seen, right underneath it. */}
      {roundType.needsVoting ? (
        <FibbageResults game={game} question={question} answers={answers} meId={meId} isHost={isHost} />
      ) : (
        <>
          {/* `myAnswer` is undefined for anyone who did not answer this
              question - an auction they lost the bidding on, or a question
              they simply missed - so the stake has to be read defensively.
              MyResult already copes with no answer; reaching through it for
              an id did not. */}
          {!isHost && (
            <MyResult
              game={game}
              answer={myAnswer}
              question={question}
              roundType={roundType}
              effective={effective}
              cappedStake={myAnswer ? stakes[myAnswer.id] : undefined}
            />
          )}
          <RoomResults game={game} answers={answers} roundType={roundType} effective={effective} stakes={stakes} />
        </>
      )}
      </div>

      {/* The rail carries the standings AND the way out. The results list on
          the left is one entry per player and grows with the room - at four
          players it already ran 457px past the bottom of a 1440x900 window.
          That USED to put "Next question" - the only control that moves the
          night on - behind a private scrollbar on this one column, which
          nobody thought to look for: the host had to find and drag a
          scrollbar hiding in one corner while everything else on screen
          looked finished. It now grows the whole page instead
          (`HANDOFF-19.md`) - the ordinary, visible scrollbar a twelve-player
          room needs is the same one a four-player room never sees. */}
      <div className="flex shrink-0 flex-col gap-5 desktop:justify-between desktop:border-l-2 desktop:border-rule desktop:pl-9">
      <div className="shrink-0">
        <StandingsPanel game={game} meId={meId} isHost={isHost} />

        {isHost && (
          <div className="mt-[18px]">
            <ScoreAdjuster game={game} onRemovePlayer={onRemovePlayer} />
          </div>
        )}
      </div>

      <div className="shrink-0">
        {isHost ? (
          <BigButton onClick={onNextQuestion}>
            {lastInCategory ? 'See how this ledger closed' : 'Next question'}
          </BigButton>
        ) : (
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">
            {lastInCategory ? 'That ledger is closed. Sit tight…' : 'Waiting for the next question…'}
          </p>
        )}
        <div className="mt-4 flex justify-center">
          <OneLiner>{say(identity.oneLiner)}</OneLiner>
        </div>
      </div>
      </div>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// The verdict slab at the top of a result. No mark and no picture: the colour
// and the words carry it, which is the same call the round-results header
// makes. A drawn icon for "you were wrong" would be one joke too many at the
// exact moment somebody just got it wrong.
// ---------------------------------------------------------------------------
function VerdictPanel({ tone, heading, children }) {
  return (
    <Plate hero className="mt-[18px] overflow-hidden p-0">
      <div className={'border-b px-[18px] py-3.5 text-center ' + TONES[tone]}>
        <p className="font-impact text-[22px] desktop:text-[28px] leading-[1.05] uppercase">{heading}</p>
      </div>
      <div className="px-[18px] py-[18px]">{children}</div>
    </Plate>
  )
}

// The big "how you did" panel for a player, worded to suit the round.
function MyResult({ game, answer, question, roundType, effective, cappedStake }) {
  const say = useSay()
  if (!answer || (roundType.needsBidding && !answer.submitted)) {
    return (
      <Plate className="mt-[18px] px-[18px] py-5">
        <p className="text-center text-[15px] desktop:text-[19px] text-dim">
          {roundType.needsBidding
            ? 'You were outbid on this one.'
            : 'You did not answer this one.'}
        </p>
      </Plate>
    )
  }

  const points = effective[answer.id] || 0
  const won = points > 0
  // The VERDICT is still read from what the judge actually gave, not from the
  // points after a card bent them - her words should be her words.
  const verdict = verdictFromPoints(answer.pointsAwarded)

  // Rounds she judges by hand show the verdict she actually gave, in her own
  // three words. Rounds the app scores get a line that suits what happened.
  let heading
  let tone
  if (roundType.key === 'pitch') {
    heading = won ? 'Yours was picked' : 'Someone else was picked'
    tone = won ? 'good' : 'bad'
  } else if (roundType.needsBidding) {
    heading = won ? 'You won the gamble' : 'That bid did not pay off'
    tone = won ? 'good' : 'bad'
  } else if (roundType.judgeMode === JUDGE_MODES.AUTO_MATCH) {
    heading = 'How close you got'
    tone = won ? 'good' : 'middling'
  } else if (roundType.judgeMode === JUDGE_MODES.AUTO) {
    heading = won ? 'Nice guess' : 'Not close enough'
    tone = won ? 'good' : 'bad'
  } else if (roundType.hasWager) {
    heading = won ? 'You won your bet' : 'You lost your bet'
    tone = won ? 'good' : 'bad'
  } else {
    heading = say(VERDICT_LABELS[verdict] || 'Not scored yet')
    tone = verdict === VERDICTS.CORRECT ? 'good' : verdict === VERDICTS.PARTIAL ? 'middling' : 'bad'
  }

  const swing = pointsToScore(game, answer, points, cappedStake)

  return (
    <VerdictPanel tone={tone} heading={heading}>
      <Eyebrow className="text-dim" size={10} tracking="0.16em">
        You said
      </Eyebrow>

      <div className="mt-2.5">
        {roundType.inputType === 'rank' ? (
          <ol className="flex flex-col gap-2">
            {(answer.order || []).map((item, index) => {
              const trueOrder = question.trueOrder || []
              const correctIndex = trueOrder.indexOf(item)
              const distance = correctIndex === -1 ? 99 : Math.abs(correctIndex - index)
              return (
                <li
                  key={item}
                  className={
                    'flex min-h-[46px] items-center gap-3 border px-3.5 py-2.5 ' +
                    (distance === 0
                      ? 'border-red bg-board-warm'
                      : 'border-line bg-panel')
                  }
                >
                  <span className="grid h-[28px] w-[28px] shrink-0 place-items-center border border-red font-mono text-[13px] desktop:text-[17px] text-red">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] desktop:text-[19px] text-ivory">{item}</span>
                  {distance === 0 && (
                    <span className="shrink-0 font-mono text-[11px] desktop:text-[14px] text-red uppercase">
                      Exact
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="border border-line bg-panel px-3.5 py-3 font-mono text-[16px] desktop:text-[20px] break-words text-ivory">
            {answer.text}
          </p>
        )}
      </div>

      {/* A DIV, NOT A P. `Eyebrow` renders a paragraph of its own, and a
          paragraph inside a paragraph is invalid - browsers are each allowed
          to repair it differently, and every guest is on a different browser.
          React logged an error here on every reveal, for every player. */}
      <div className="mt-4 text-center">
        <span
          className={
            'font-mono text-[36px] desktop:text-[46px] leading-none tabular-nums ' +
            (swing >= 0 ? 'text-red' : 'text-dim')
          }
        >
          {swing >= 0 ? '+' : ''}
          {swing}
        </span>
        <Eyebrow className="mt-1 text-dim" size={10} tracking="0.16em">
          point{Math.abs(swing) === 1 ? '' : 's'}
        </Eyebrow>
      </div>
    </VerdictPanel>
  )
}

// The host's view of how everyone did on this question.
function RoomResults({ game, answers, roundType, effective, stakes }) {
  const shown = roundType.needsBidding ? answers.filter((a) => a.submitted) : answers

  return (
    <Plate hero className="mt-[18px] px-[18px] py-5">
      <PanelHeading right={<CountPill>{shown.length} answered</CountPill>}>
        This question
      </PanelHeading>

      {/* Name and score on one line, the answer on its own underneath it -
          the same shape the fibbage breakdown below uses, and for the same
          reason: a shared row is too narrow a column for a long answer. */}
      <ul className="mt-4 flex flex-col gap-2">
        {shown.map((answer) => {
          const player = findPlayer(game, answer.playerId)
          const swing = pointsToScore(game, answer, effective[answer.id] || 0, stakes[answer.id])
          const said =
            roundType.inputType === 'rank' ? (answer.order || []).join(', ') : answer.text

          return (
            <li key={answer.id} className="border border-line bg-panel px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[15px] desktop:text-[19px] text-ivory">
                  {player ? player.displayName : 'Unknown'}
                </span>
                <span
                  className={
                    'shrink-0 font-mono text-[18px] desktop:text-[23px] tabular-nums ' +
                    (swing >= 0 ? 'text-red' : 'text-dim')
                  }
                >
                  {swing >= 0 ? '+' : ''}
                  {swing}
                </span>
              </div>
              {/* break-words as well as wrapping: one long unbroken word - a
                  URL, or somebody leaning on a key - would otherwise run
                  straight off the side of the panel. Courier only for actual
                  typed prose - a rank order is item labels, not something
                  this player wrote, so it stays in the body face. */}
              {said && (
                <p
                  className={
                    'mt-1 break-words text-dim ' +
                    (roundType.inputType === 'rank' ? 'text-[14px] desktop:text-[18px]' : 'font-mono text-[13.5px] desktop:text-[17px]')
                  }
                >
                  {said}
                </p>
              )}
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="py-3 text-center text-[15px] desktop:text-[19px] text-dim">Nobody answered.</li>
        )}
      </ul>
    </Plate>
  )
}

// Who fooled whom, which is the whole joy of the round.
function FibbageResults({ game, question, answers, meId, isHost }) {
  const votes = votesForQuestion(game, question.id)
  // Votes were cast against published ballot ids, so which one WAS the truth
  // has to be looked up. By the reveal everyone is entitled to know, so the
  // key arrives with the answer - mid-vote it would not have.
  const voteMap = voteMapFor(question)
  const truthOptionId = truthOptionIdFrom(voteMap) || TRUTH_OPTION_ID
  const truthVoters = votes.filter((vote) => vote.choiceId === truthOptionId)
  const myVote = voteFor(game, question.id, meId)
  const iFoundIt = myVote && myVote.choiceId === truthOptionId

  // A vote records a BALLOT id, not an answer id, and the two never match -
  // the whole point of publishing the ballot is that its ids mean nothing on
  // their own. This has to be translated back before anyone can be told who
  // fell for what, exactly as `scoreFibbage` does when it works the points out.
  //
  // Missing this is what made every single line below read "Fooled nobody" all
  // night, including next to a "+1" awarded for fooling somebody. A game whose
  // vote opened before the ballot existed has no map, and its votes already
  // carry the real answer ids, which is what the fallback is for.
  const answerVotedFor = (vote) => (voteMap ? voteMap[vote.choiceId] : vote.choiceId)

  return (
    <>
      {!isHost && (
        <VerdictPanel tone={iFoundIt ? 'good' : 'bad'} heading={iFoundIt ? 'You found the truth' : 'You fell for a lie'}>
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">
            The real answer was <span className="font-semibold text-ivory">{question.trueAnswer}</span>
          </p>
        </VerdictPanel>
      )}

      <Plate hero className="mt-[18px] px-[18px] py-5">
        <PanelHeading>Who fooled whom</PanelHeading>

        <p className="mt-3 text-[13.5px] desktop:text-[17px] text-dim italic">
          One point for every person your lie caught, two for spotting the real answer.
        </p>

        <div className="mt-3 border border-red bg-board-warm px-3.5 py-3">
          <Eyebrow className="text-red" size={10} tracking="0.16em">
            The truth
          </Eyebrow>
          <p className="mt-1 text-[15px] desktop:text-[19px] font-semibold text-ivory">{question.trueAnswer}</p>
          <p className="mt-1 text-[13.5px] desktop:text-[17px] text-dim">
            {truthVoters.length === 0
              ? 'Nobody found it.'
              : 'Found by ' +
                truthVoters
                  .map((vote) => {
                    const player = findPlayer(game, vote.playerId)
                    return player ? player.displayName : 'someone'
                  })
                  .join(', ')}
          </p>
        </div>

        {/* Only people who actually wrote something appear here. Somebody who
            never filed a lie but voted has a scoring slot of their own (see
            `App.lockVotes`) so their two points for finding the truth have
            somewhere to land - but they have no statement, and an empty pair of
            quote marks under their name would read as a bug. */}
        <ul className="mt-3 flex flex-col gap-2">
          {answers.filter((a) => a.text && a.text.trim() !== '').map((answer) => {
            const author = findPlayer(game, answer.playerId)
            // A vote for your own lie is worth nothing (`scoreFibbage` drops
            // it) so it must not be listed here either. It is now possible to
            // cast one - the voting screen marks your own answer rather than
            // refusing it - and without this the line read "Ana +0 … Fooled
            // Ana", which is the same nonsense the first audit found printed
            // the other way round.
            const fooled = votes.filter(
              (vote) => answerVotedFor(vote) === answer.id && vote.playerId !== answer.playerId,
            )

            return (
              <li key={answer.id} className="border border-line bg-panel px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-[15px] desktop:text-[19px] text-ivory">{author ? author.displayName : 'Unknown'}</span>
                  <span className="ml-auto font-mono text-[18px] desktop:text-[23px] text-red tabular-nums">
                    +{answer.pointsAwarded || 0}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[14.5px] desktop:text-[19px] break-words text-ivory">
                  &ldquo;{answer.text}&rdquo;
                </p>
                <p className="mt-1 text-[13.5px] desktop:text-[17px] text-dim">
                  {fooled.length === 0
                    ? 'Fooled nobody.'
                    : 'Fooled ' +
                      fooled
                        .map((vote) => {
                          const player = findPlayer(game, vote.playerId)
                          return player ? player.displayName : 'someone'
                        })
                        .join(', ')}
                </p>
              </li>
            )
          })}
        </ul>
      </Plate>
    </>
  )
}

// Where everyone stands, after this question.
function StandingsPanel({ game, meId, isHost }) {
  return (
    <Plate hero className="mt-[18px] px-[18px] py-5">
      <PanelHeading>Standings</PanelHeading>
      <div className="mt-4">
        <Standings entries={rankedPlayers(game)} meId={meId} isHost={isHost} />
      </div>
    </Plate>
  )
}
