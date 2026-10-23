import {
  Screen,
  Plate,
  Card,
  BigButton,
  OneLiner,
  ErrorBanner,
  Eyebrow,
  CountPill,
  GodName,
  ProgressBar,
  Figure,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  answersForQuestion,
  findPlayer,
  activePlayers,
} from '../gameHelpers.js'
import {
  roundTypeFor,
  JUDGE_MODES,
  VERDICTS,
  VERDICT_POINTS,
  VERDICT_LABELS,
  verdictsFor,
  verdictFromPoints,
} from '../roundTypes.js'
import { assignAliases } from '../roundIdentity.js'
import PowerUpNotices from '../components/PowerUpNotices.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// THE GRILLING - judging, host only. The dense one.
//
// The judge's job is DIFFERENT in every round, so this screen picks one of
// four panels based on the round type. In two of them she does no per-player
// judging at all, which is the whole point: her workload must not grow with
// the number of players in every single round.
//
// TWO RULES HOLD THIS SCREEN TOGETHER.
//
// 1. SHE NEVER TYPES A NUMBER. Three verdicts, fixed points, and no way to
//    hand out an arbitrary amount. Free choice meant the same quality of
//    answer could be worth different amounts depending on her mood at that
//    moment, which is unfair on whoever happened to be judged last. Rounds
//    the app scores itself are shown here read-only - she is looking, not
//    scoring. If something needs correcting she does it on the results
//    screen, against a player's total, where it is visible to everyone
//    rather than buried inside one answer.
//
// 2. SHE NEVER SEES A NAME. Every answer she passes judgement on is signed by
//    a god instead, and the mapping is reshuffled EVERY ROUND. A mapping that
//    held all night would be learned once and then read all night, which
//    defeats the entire point of hiding names. The lobby deliberately shows a
//    player's own name with a plain initial and no god, so nothing links the
//    two.
//
// No timer here, deliberately - the host reads and judges at her own pace,
// and a countdown over someone else's careful reading would be the one place
// this app's timers would work against the room rather than for it.
//
// Restyled to the room language. A verdict follows the house rule (a gain is
// red, a loss is grey): APPROVES fills solid red, HALF RIGHT outlines red,
// ABSOLUTELY NOT stays a plain grey outline - no orange, no green anywhere.
// ---------------------------------------------------------------------------

export default function JudgingScreen({ game, onSetPoints, onPickWinner, onFinishJudging }) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)

  if (!question) {
    return (
      <Screen maxWidth={760} desktopMaxWidth={860} centerY={false} roomCode={game.roomCode}>
        <Plate hero className="p-5">
          <ErrorBanner message="This question is missing. Move on to the next one." />
          <div className="mt-4">
            <BigButton onClick={onFinishJudging}>Continue</BigButton>
          </div>
        </Plate>
      </Screen>
    )
  }

  const roundType = roundTypeFor(question)
  // The auction only has the winning bidder's answer to score.
  const answers = answersForQuestion(game, question.id).filter((answer) =>
    roundType.needsBidding ? answer.submitted : true,
  )

  // Seeded by the QUESTION, not the category. The reveal screen names
  // everyone once a question is scored (AUDIT.md finding 29), so a mapping
  // held for a whole round was only ever hiding names for the first question
  // of it - by question two she could match a god to a name from the
  // question before and read the rest of the round through it. A new mapping
  // every question means that reveal can never teach her the next one, and it
  // also means the mapping cannot shift under her mid-round if someone joins
  // or leaves (finding 30), because there is no "mid-round" mapping to shift.
  const gods = assignAliases(activePlayers(game).map((player) => player.id), question.id)

  let panel
  if (roundType.judgeMode === JUDGE_MODES.PICK_WINNER) {
    panel = pickWinnerPanel({ game, answers, gods, onPickWinner })
  } else if (roundType.judgeMode === JUDGE_MODES.AUTO) {
    panel = autoPanel({ game, question, answers })
  } else if (roundType.judgeMode === JUDGE_MODES.AUTO_MATCH) {
    panel = autoMatchPanel({ game, question, answers })
  } else {
    panel = scoreEachPanel({ answers, gods, roundType, onSetPoints, say })
  }

  return (
    <Screen
      pad={false}
      status={{
        left: say(roundType.label) + ' · Q' + position.number + ' of ' + position.total,
        right: <CountPill>{panel.progressLabel}</CountPill>,
      }}
      footer={{ left: 'Names are hidden · they will work it out anyway', right: game.roomCode }}
    >
      {/* The question opens the screen and the answer grid follows it down the
          page. This screen used to pin the question and scroll the grid under
          it - the last private scroller left in the app after `HANDOFF-20.md`
          §4 removed the rest - on the argument that a judge needs the question
          in view while she works. Snehin's call, and it is the right one: one
          ordinary page scroll everywhere beats a scrollbar hidden inside one
          region, and a judge who has scrolled past the question can scroll back
          to it the same way she would on any other page. The question is sized
          smaller here than on the question screens precisely because it shares
          its column with a grid that can run to a dozen answers. */}
      <div className="gutter border-b-[3px] border-red pt-5 pb-4 desktop:pt-6 desktop:pb-[18px]">
        <p
          className="font-impact uppercase text-ivory"
          style={{
            fontSize: 'clamp(19px, 3.9cqw, 31px)',
            lineHeight: 0.97,
            letterSpacing: '-0.035em',
          }}
        >
          {question.text}
        </p>
        <ProgressBar done={panel.done} total={panel.total} className="mt-3.5" />
      </div>

      <div className="gutter py-5">
        <PowerUpNotices game={game} questionId={question.id} phase="judging" />
        {panel.body}
      </div>

      <div className="gutter mt-auto pb-4">
        <div className="flex items-center justify-between gap-4 pb-2.5">
          <OneLiner className="min-w-0 flex-1">{say(panel.oneLiner)}</OneLiner>
          {panel.footerNote && (
            <p
              className="shrink-0 font-mono text-[10px] font-bold uppercase text-red-bright"
              style={{ letterSpacing: '0.18em' }}
            >
              {panel.footerNote}
            </p>
          )}
        </div>
        <BigButton onClick={onFinishJudging} disabled={!panel.canFinish}>
          Publish the verdict
        </BigButton>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// One answer, signed by a god. Shared by the two panels where she is actually
// passing judgement, so an answer looks the same whether she is scoring it or
// crowning it.
// ---------------------------------------------------------------------------
function AnswerCard({ god, text, accent = false, children }) {
  return (
    <Card accent={accent}>
      <div className="flex items-start gap-3">
        <span className="grid h-[36px] w-[36px] shrink-0 place-items-center border border-line text-dim">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={god.mark} />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <GodName className="block leading-[1.1]">{god.name}</GodName>
          {/* break-words, because one long unbroken word (a URL, or somebody
              leaning on a key) otherwise runs straight off the panel and she
              only gets to read the first few characters of it. Courier, not
              the body face - the design's own rule for anything a player
              typed: it reads as typewritten evidence. */}
          <p className="mt-1 font-mono text-[16px] desktop:text-[20px] leading-[1.4] break-words text-ivory">{text}</p>
        </div>
      </div>

      {children}
    </Card>
  )
}

// The three verdict looks. A gain is red, a loss is grey - the house rule
// holds even here, where the old look reached for orange and green.
const VERDICT_LOOK = {
  [VERDICTS.CORRECT]: 'border-red bg-red text-bone',
  [VERDICTS.PARTIAL]: 'border-red bg-board-warm text-red',
  [VERDICTS.WRONG]: 'border-line bg-panel text-dim',
}

// ---------------------------------------------------------------------------
// MODE 1 - score_each. The Canvass, The Leverage, The Payoff, The Last Word.
// ---------------------------------------------------------------------------
// `say` is passed in rather than hooked: these panels are plain functions,
// picked between with an if/else, so a hook inside one would not run in the
// same order on every render.
function scoreEachPanel({ answers, gods, roundType, onSetPoints, say }) {
  const unjudged = answers.filter((answer) => answer.pointsAwarded === null).length
  const done = answers.length - unjudged

  // Staked rounds drop the middle option: on a bet you either win it or you
  // lose it, and "half right" has no meaning there.
  const staked = Boolean(roundType && roundType.hasWager)
  const choices = verdictsFor(roundType)

  const body = (
    <div className="flex flex-col gap-3 desktop:grid desktop:grid-cols-3 desktop:items-start desktop:gap-4">
      {answers.length === 0 && (
        <Card className="desktop:col-span-full">
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">Nobody answered this one.</p>
        </Card>
      )}

      {answers.map((answer) => {
        const god = gods[answer.playerId] || { name: 'Unknown', mark: 'M8 12 L16 12' }
        const chosen = verdictFromPoints(answer.pointsAwarded)

        return (
          <AnswerCard key={answer.id} god={god} text={answer.text} accent={Boolean(chosen)}>
            {staked && (
              <p className="mt-2.5 font-mono text-[11px] desktop:text-[14px] text-red uppercase" style={{ letterSpacing: '0.1em' }}>
                {answer.wager || answer.bid || 0} at stake
              </p>
            )}

            {/* Below the answer, never beside it, so they stay under a thumb
                at any width. */}
            <div className="mt-3 flex flex-wrap gap-[7px]">
              {choices.map((verdict) => {
                const isChosen = chosen === verdict
                return (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => onSetPoints(answer.id, VERDICT_POINTS[verdict])}
                    className={
                      'focus-ring min-h-[50px] flex-[1_1_104px] border px-3 font-mono text-xs uppercase ' +
                      (isChosen ? VERDICT_LOOK[verdict] : 'border-line bg-panel text-ivory')
                    }
                    style={{ letterSpacing: '0.06em' }}
                  >
                    {say(VERDICT_LABELS[verdict])}
                  </button>
                )
              })}
            </div>
          </AnswerCard>
        )
      })}
    </div>
  )

  return {
    body,
    done,
    total: answers.length,
    progressLabel: done + ' of ' + answers.length + ' scored',
    oneLiner: 'Names are hidden · {They} will work it out anyway',
    canFinish: unjudged === 0,
    footerNote:
      unjudged > 0 ? unjudged + ' answer' + (unjudged === 1 ? '' : 's') + ' still to score.' : null,
  }
}

// ---------------------------------------------------------------------------
// MODE 2 - auto. The Estimate.
// She does nothing except look; the points were worked out when answers
// locked. Real names here, because no judgement is being passed and half the
// fun is seeing who said what.
// ---------------------------------------------------------------------------
function autoPanel({ game, question, answers }) {
  const sorted = [...answers].sort((a, b) => {
    const da = Math.abs((a.number == null ? Infinity : a.number) - question.trueNumber)
    const db = Math.abs((b.number == null ? Infinity : b.number) - question.trueNumber)
    return da - db
  })

  const body = (
    <div className="flex flex-col gap-3 desktop:grid desktop:grid-cols-3 desktop:items-start desktop:gap-4">
      <Card accent className="text-center desktop:col-span-full">
        <Eyebrow className="text-dim" size={10} tracking="0.18em">
          The real answer
        </Eyebrow>
        <Figure size={44} tone="gain" className="mt-1.5 justify-center">
          {question.trueNumber}
        </Figure>
      </Card>

      {sorted.length === 0 && (
        <Card className="desktop:col-span-full">
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">Nobody guessed.</p>
        </Card>
      )}

      {sorted.map((answer) => {
        const player = findPlayer(game, answer.playerId)
        const distance = Math.abs((answer.number || 0) - question.trueNumber)
        const points = answer.pointsAwarded || 0

        return (
          <div
            key={answer.id}
            className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 border border-line bg-panel px-3.5 py-3"
          >
            <span className="text-[15px] desktop:text-[19px] text-ivory">{player ? player.displayName : 'Unknown'}</span>
            <span className="font-mono text-[19px] desktop:text-[24px] text-ivory tabular-nums">{answer.number}</span>
            <span className="text-[13px] desktop:text-[17px] text-dim">
              {distance === 0 ? 'exact' : 'off by ' + distance}
            </span>
            <span className="ml-auto font-mono text-[17px] desktop:text-[22px] text-red tabular-nums">+{points}</span>
          </div>
        )
      })}
    </div>
  )

  return {
    body,
    done: 1,
    total: 1,
    progressLabel: 'Scored for you',
    oneLiner: 'The number is the number · No appeals',
    canFinish: true,
    footerNote: null,
  }
}

// ---------------------------------------------------------------------------
// MODE 3 - auto_match. The Line-Up.
// She built her own order during the round; players are matched against it.
// ---------------------------------------------------------------------------
function autoMatchPanel({ game, question, answers }) {
  const trueOrder = question.trueOrder || []

  const body = (
    <div className="flex flex-col gap-3 desktop:grid desktop:grid-cols-3 desktop:items-start desktop:gap-4">
      <Card accent className="desktop:col-span-full">
        <Eyebrow className="text-dim" size={10} tracking="0.18em">
          Your order
        </Eyebrow>
        {trueOrder.length === 0 ? (
          <p className="mt-2 text-[15px] desktop:text-[19px] text-dim">
            You didn&apos;t set an order for this one, so nobody can be scored against it.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {trueOrder.map((item, index) => (
              <li
                key={item}
                className="flex min-h-[44px] items-center gap-3 border border-line bg-panel px-3 py-2"
              >
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center border border-red font-mono text-[13px] desktop:text-[17px] text-red">
                  {index + 1}
                </span>
                <span className="min-w-0 text-[15px] desktop:text-[19px] text-ivory">{item}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {answers.map((answer) => {
        const player = findPlayer(game, answer.playerId)
        return (
          <Card key={answer.id}>
            <div className="flex items-center gap-3">
              <span className="text-[15px] desktop:text-[19px] text-ivory">{player ? player.displayName : 'Unknown'}</span>
              <span className="ml-auto font-mono text-[17px] desktop:text-[22px] text-red tabular-nums">
                +{answer.pointsAwarded || 0}
              </span>
            </div>

            <ol className="mt-2.5 flex flex-wrap gap-1.5">
              {(answer.order || []).map((item, index) => {
                const correctIndex = trueOrder.indexOf(item)
                const distance = correctIndex === -1 ? 99 : Math.abs(correctIndex - index)
                const tone =
                  distance === 0
                    ? 'border-red text-red'
                    : distance === 1
                      ? 'border-line text-ivory'
                      : 'border-line/50 text-dim'
                return (
                  <span key={item} className={'border px-2 py-1 text-[12px] desktop:text-[15px] ' + tone}>
                    {index + 1}. {item}
                  </span>
                )
              })}
            </ol>
          </Card>
        )
      })}
    </div>
  )

  return {
    body,
    done: 1,
    total: 1,
    progressLabel: 'Matched for you',
    oneLiner: 'The file sorted itself · You only have to read it',
    canFinish: true,
    footerNote: null,
  }
}

// ---------------------------------------------------------------------------
// MODE 4 - pick_winner. The Cover Story.
// One decision for the whole round, and still anonymous: she is choosing a
// favourite, which is exactly the moment knowing the author would sway it.
// ---------------------------------------------------------------------------
function pickWinnerPanel({ game, answers, gods, onPickWinner }) {
  const picked = game.winnerAnswerId

  const body = (
    <div className="flex flex-col gap-3 desktop:grid desktop:grid-cols-3 desktop:items-start desktop:gap-4">
      {answers.length === 0 && (
        <Card className="desktop:col-span-full">
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">Nobody pitched anything.</p>
        </Card>
      )}

      {answers.map((answer) => {
        const god = gods[answer.playerId] || { name: 'Unknown', mark: 'M8 12 L16 12' }
        const isWinner = picked === answer.id

        return (
          <AnswerCard key={answer.id} god={god} text={answer.text} accent={isWinner}>
            <button
              type="button"
              onClick={() => onPickWinner(answer.id)}
              className={
                'focus-ring mt-3 min-h-[50px] w-full border px-3 font-mono text-xs uppercase ' +
                (isWinner
                  ? 'border-red bg-red text-bone'
                  : 'border-line bg-panel text-ivory')
              }
              style={{ letterSpacing: '0.06em' }}
            >
              {isWinner ? 'Crowned' : 'Crown this one'}
            </button>
          </AnswerCard>
        )
      })}
    </div>
  )

  const chosen = picked !== null && picked !== undefined

  return {
    body,
    done: chosen ? 1 : 0,
    total: 1,
    progressLabel: chosen ? 'Winner chosen' : 'Pick one',
    oneLiner: 'Names are hidden · {They} will work it out anyway',
    canFinish: chosen || answers.length === 0,
    footerNote: !chosen && answers.length > 0 ? 'Pick a winner to continue.' : null,
  }
}
