import { useEffect, useRef } from 'react'
import {
  Screen,
  Clock,
  PlayerTag,
  Plate,
  Card,
  BigButton,
  OneLiner,
  ErrorBanner,
  Eyebrow,
  Figure,
  ProgressBar,
  OptionRow,
  TimeLeft,
  TooSlow,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  answersForQuestion,
  votesForQuestion,
  voteFor,
  activePlayers,
  badgeNumberFor,
} from '../gameHelpers.js'
import { ballotFor, voteMapFor, truthOptionIdFrom, ROUND_TYPES } from '../roundTypes.js'
import { identityFor } from '../roundIdentity.js'
import { useCountdown } from '../useCountdown.js'
import { currentBadgeFor } from '../badge.js'
import RoundBand from '../components/RoundBand.jsx'
import TimerControl from '../components/TimerControl.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// THE ALIBI - voting phase, 3D in the design bundle.
//
// Everyone wrote a lie. Now every lie, plus the real answer, is shown to
// the PLAYERS, and they guess which one is true.
//
// This is the fix for the original "Fool the Judge": the judge cannot be the
// one guessing, because she wrote the true answer about her own life and
// would recognise it instantly. Flipping who guesses makes it a real game,
// and she gets the best seat in the house - watching people fall for each
// other's lies.
//
// You score two ways: +1 for each person your lie fools, +2 for finding the
// truth yourself. You cannot vote for your own lie.
//
// Restyled to the room language - was still the pre-redesign look. Uses
// `OptionRow`, already built for exactly this shape (letter, own, selected).
// No behaviour changed.
// ---------------------------------------------------------------------------

const LETTERS = 'ABCDEFGH'

export default function VotingScreen({
  game,
  isHost,
  meId,
  onSubmitVote,
  onLockVotes,
  onStartTimer,
  onExtendTimer,
  onClearTimer,
}) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)
  const identity = identityFor('fib')
  const { secondsLeft, expired } = useCountdown(game.timerEndsAt)

  // AUTO-LOCK, host only. Same rule as everywhere else a timer runs: zero
  // means close the vote, exactly as if the button had been pressed.
  const autoLocked = useRef(false)
  useEffect(() => {
    if (!isHost || !expired || autoLocked.current) return
    autoLocked.current = true
    onLockVotes()
  }, [isHost, expired, onLockVotes])

  if (!question) {
    return (
      <Screen maxWidth={620} centerY={false} roomCode={game.roomCode}>
        <Plate hero className="p-5">
          <ErrorBanner message="This question is missing." />
        </Plate>
      </Screen>
    )
  }

  const roundType = ROUND_TYPES.fib
  const answers = answersForQuestion(game, question.id)
  // The ballot the host published when the vote opened - see
  // `publishVoteOptions`. Every id in it is meaningless on its own, so a
  // player's copy no longer says which option is the real answer.
  const options = ballotFor(question, answers)
  const votes = votesForQuestion(game, question.id)

  // Only the host is given the key to those ids, so only the host's copy of
  // this resolves to anything. On a player's screen it stays null.
  const truthOptionId = truthOptionIdFrom(voteMapFor(question))

  // Which option is my own lie. Matched on the text I wrote, because the
  // ballot deliberately carries no authorship - if two people wrote the same
  // words they are indistinguishable anyway, and both get the same courtesy.
  const myAnswer = answers.find((a) => a.playerId === meId)

  const band = (
    <RoundBand roundType={roundType} position={position} secondsLeft={secondsLeft} />
  )

  const header = (
    <>
      <Plate hero className="px-[18px] py-5">
        <Eyebrow className="text-dim" size={9.5} tracking="0.16em">
          The statement
        </Eyebrow>
        <p
          className="mt-1.5 font-impact leading-[1.06] text-ivory uppercase"
          style={{ fontSize: 'clamp(22px, 3.8cqw, 28px)' }}
        >
          {question.text}
        </p>
      </Plate>
    </>
  )

  // --- Host view: read them out and watch the votes land --------------------
  if (isHost) {
    return (
      <Screen
        fixed
        scroll
        status={{ left: 'The alibi · the line-up', right: 'Case ' + game.roomCode + ' · host view' }}
        band={band}
        footer={{ left: 'Only you know which one is real', right: game.roomCode }}
      >
        {header}

        <p className="mt-4 text-center text-[15px] desktop:text-[19px] text-dim">
          Read these out. Only you know which one is real.
        </p>

        {/* A grid on desktop rather than the same stack stretched wide -
            bundle 2's own "Desktop line-up" lays the statements out this
            way (as a row of cards, not a column), and five short lines
            genuinely read better side by side than as one long list once
            there is the width for it. */}
        <div className="mt-4 flex flex-col gap-2.5 desktop:grid desktop:grid-cols-3 desktop:gap-3.5">
          {options.map((option, index) => (
            <Card key={option.id} accent={option.id === truthOptionId}>
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow className="text-dim" size={9.5} tracking="0.16em">
                  {LETTERS[index] || index + 1}
                </Eyebrow>
                {option.id === truthOptionId && (
                  <Eyebrow className="text-red" size={9.5} tracking="0.16em">
                    The real one
                  </Eyebrow>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[16px] desktop:text-[20px] leading-[1.4] break-words text-ivory">
                {option.text}
              </p>
            </Card>
          ))}
        </div>

        <TimerControl
          secondsLeft={secondsLeft}
          onStart={onStartTimer}
          onExtend={onExtendTimer}
          onClear={onClearTimer}
        />

        {/* The tally and the button sit SIDE BY SIDE on a laptop, and that is
            a fit fix as much as a composition one. Stacked, this screen came
            to 795px inside a 761px frame on an ordinary 1440x900 window - it
            fell back on `Screen`'s scroll and the host had to drag to reach
            the only control they have. The tally card is 109px of that for one
            number and a bar; put beside the button it costs nothing, and the
            two of them are one thought anyway ("this many are in - close it").
            Measured after: 670px in the same frame, 91px clear. */}
        <div
          className="mt-4 flex flex-col gap-4 desktop:grid desktop:grid-cols-2
                     desktop:items-center desktop:gap-5"
        >
          <Card>
            <div className="flex items-baseline gap-2.5">
              <Figure size={42} tone="gain">
                {votes.length}
              </Figure>
              <span className="font-mono text-[17px] desktop:text-[22px] text-dim">/ {activePlayers(game).length}</span>
              <Eyebrow className="ml-auto text-dim" size={9.5} tracking="0.16em">
                Votes in
              </Eyebrow>
            </div>
            <ProgressBar done={votes.length} total={activePlayers(game).length} />
          </Card>

          <div>
            {/* Deliberately NOT switched off when nobody has voted. It is the
                only control on this screen, so disabling it left the host with
                literally nothing to press - and the whole night stuck on one
                question - if the room got talking and forgot to tap. Moving on
                with no votes scores nobody, which is a fine outcome and much
                better than a dead end. */}
            <BigButton onClick={onLockVotes}>Close the vote and reveal</BigButton>
            {votes.length === 0 && (
              <p className="mt-2.5 text-center text-[13px] desktop:text-[17px] font-semibold text-red">
                Nobody has voted yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <OneLiner>{say(identity.oneLiner)}</OneLiner>
        </div>
      </Screen>
    )
  }

  // --- Player view: pick the one you think is true ---------------------------
  const myVote = voteFor(game, question.id, meId)
  const badge = currentBadgeFor(game, meId)
  const badgeNo = badgeNumberFor(game, meId)

  if (expired && !myVote) {
    return <TooSlow detail="The vote closed before you picked one." />
  }

  return (
    <Screen
      fixed
      scroll
      status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
      band={band}
      footer={{ left: 'One of these is true', right: game.roomCode }}
    >
      {header}

      <p className="mt-4 text-center text-[15px] desktop:text-[19px] text-dim">
        One of these is true. The rest your friends made up.
      </p>

      {secondsLeft !== null && <TimeLeft secondsLeft={secondsLeft} className="mt-3" />}

      <div className="mt-4 flex flex-col gap-2.5 desktop:grid desktop:grid-cols-3 desktop:gap-3.5">
        {options.map((option, index) => {
          const isMine = Boolean(myAnswer && myAnswer.text === option.text)
          const isPicked = myVote && myVote.choiceId === option.id

          return (
            <OptionRow
              key={option.id}
              letter={LETTERS[index] || index + 1}
              own={isMine}
              selected={isPicked}
              onClick={() => onSubmitVote(option.id)}
            >
              {option.text}
            </OptionRow>
          )
        })}
      </div>

      {myVote && (
        <p className="mt-5 text-center text-[14px] desktop:text-[18px] text-dim">
          {say('That is your guess in. You can still change it until {name} closes the vote.')}
        </p>
      )}

      <div className="mt-6 flex justify-center">
        <OneLiner>{say(identity.oneLiner)}</OneLiner>
      </div>
    </Screen>
  )
}
