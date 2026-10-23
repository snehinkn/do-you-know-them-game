import { useState } from 'react'
import { shuffle } from '../shuffle.js'
import {
  Screen,
  Region,
  Card,
  Plate,
  BigButton,
  OneLiner,
  Impact,
  Title,
  Eyebrow,
  Gloss,
  FooterCaption,
  ErrorBanner,
  Mark,
  Clock,
  PlayerTag,
  LiveNote,
  TimeLeft,
  TooSlow,
} from '../ui.jsx'
import {
  currentQuestion,
  questionPosition,
  categoryPosition,
  answerFor,
  answersForQuestion,
  findPlayer,
  currentCategory,
  handFor,
  cardsPlayedOn,
  rankedPlayers,
  badgeNumberFor,
  activePlayers,
} from '../gameHelpers.js'
import { roundTypeFor, auctionWinners } from '../roundTypes.js'
import { identityFor } from '../roundIdentity.js'
import { TYPED_PROMPTS, pickFrom } from '../copy.js'
import { useSay } from '../subjectContext.js'
import { useCountdown } from '../useCountdown.js'
import { currentBadgeFor } from '../badge.js'
import RoundBand from '../components/RoundBand.jsx'
import StakePanel from '../components/StakePanel.jsx'
import PowerUpHand from '../components/PowerUpHand.jsx'
import RankInput from '../components/RankInput.jsx'
import Standings from '../components/Standings.jsx'
import { useGrowingBox } from '../components/useGrowingBox.js'

// ---------------------------------------------------------------------------
// SCREEN 4 - Question screen, player's view.
//
// The screen everyone spends most of the night looking at, on a phone, at 375px
// wide. Three stacked pieces and nothing else: the round band, the question, and
// the one control this round asks you to use.
//
// What the player does changes with the round: type an answer, tap out a number,
// put five things in order, or write a deliberate lie. The wager round adds a
// betting step before the question is shown at all.
//
// The call to action and the deadpan one-liner both come from the round's
// identity, never from a string typed in here. One place to change a joke.
// ---------------------------------------------------------------------------

// The italic line under the question. These are the app's own existing
// player-facing lines, gathered in one place rather than scattered through the
// inputs - the rank instruction used to sit above the list, the fib warning in a
// tinted box. Anything without its own line falls back to the round's blurb,
// which is already written and already approved.
const HINTS = {
  number: 'Closest guess takes the points.',
  rank: 'Put these in the order you think {name} would, favourite at the top.',
  // {name} never votes - they wrote the truth and would know it instantly.
  // The room votes, which is the whole point of the round, and this line used
  // to say the opposite.
  fib: 'Write a convincing lie. You score for every detective who falls for it.',
  wager: 'Right answer wins your bet. Wrong answer loses it.',
}

export default function QuestionScreenPlayer({
  game,
  meId,
  busy,
  onSubmitAnswer,
  onSetWager,
  onPlayPowerUp,
}) {
  const say = useSay()
  const question = currentQuestion(game)
  const position = questionPosition(game)
  const ledger = categoryPosition(game)
  const myAnswer = answerFor(game, game.currentQuestionId, meId)
  const me = findPlayer(game, meId)

  const badge = currentBadgeFor(game, meId)
  const badgeNo = badgeNumberFor(game, meId)
  const { secondsLeft, expired } = useCountdown(game.timerEndsAt)

  const [error, setError] = useState('')

  if (!question) {
    return (
      <Screen
        fixed
        centerY
        status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
        footer={{ left: 'Something is missing', right: game.roomCode }}
      >
        <Plate hero className="p-5">
          <ErrorBanner message={say('This question is not available. Ask {name} to move to the next one.')} />
        </Plate>
      </Screen>
    )
  }

  const roundType = roundTypeFor(question)
  const identity = identityFor(roundType.key)

  // LEVELLING: the leader sits this one out entirely. No answer box, no
  // waiting on them - the host's count already excludes them for the same
  // reason (see QuestionScreenHost.jsx).
  const leveller = cardsPlayedOn(game, question.id).find((card) => card.key === 'levelling')
  if (leveller && leveller.targetPlayerId === meId) {
    return (
      <Screen
        fixed
        status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
        band={
          <RoundBand roundType={roundType} position={position} secondsLeft={secondsLeft} />
        }
        footer={{ left: 'Sitting this one out', right: game.roomCode }}
      >

        <Plate hero className="mt-[18px] px-[18px] py-6 text-center">
          <Mark path={identity.mark} size={30} className="mx-auto mb-3.5" />
          <p
            className="font-impact leading-[1.12] text-ivory uppercase"
            style={{ fontSize: 'clamp(24px, 4.4cqw, 32px)' }}
          >
            You&apos;re sitting this one out
          </p>
          <p className="mt-2.5 text-[15px] desktop:text-[19px] text-dim">
            Somebody played Levelling on you, for being in the lead. You score nothing here, and
            neither can anyone stop you being in the lead again next question.
          </p>
        </Plate>

        <div className="mt-6 flex justify-center">
          <OneLiner>{say(identity.oneLiner)}</OneLiner>
        </div>
      </Screen>
    )
  }

  // AUCTION: only the winning bidder gets to ANSWER - but everybody sees the
  // question. Hiding it from the losing bidders meant most of the room sat
  // through the round with nothing to think about, and could not tell whether
  // the winner's answer was any good. Watching is more fun when you know what
  // was asked.
  if (roundType.needsBidding) {
    const winners = auctionWinners(answersForQuestion(game, question.id))
    const iWon = winners.some((answer) => answer.playerId === meId)

    if (!iWon) {
      const names = winners
        .map((answer) => {
          const player = findPlayer(game, answer.playerId)
          return player ? player.displayName : 'Someone'
        })
        .join(' and ')

      return (
        <Screen
          fixed
          pad={false}
          status={{
            left: <Clock />,
            right: <PlayerTag badgeNo={badgeNo} badge={badge} />,
          }}
          band={
            <RoundBand
              roundType={roundType}
              position={position}
              ledger={ledger.number - 1}
              secondsLeft={secondsLeft}
            />
          }
          footer={{ left: 'You are not answering this one', right: game.roomCode }}
        >
          <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_380px]">
            <Region edge="right" className="min-h-0 justify-between gap-4">
              <div className="flex flex-col gap-4">
                <Eyebrow className="text-red" size={10} tracking="0.26em">
                  The question
                </Eyebrow>
                {/* The question itself, for everyone who is not answering it. */}
                <Title>{question.text}</Title>
                <Gloss>
                  {winners.length === 0
                    ? 'Nobody bought this one, so nobody answers it.'
                    : 'You cannot answer this one. Keep it to yourself.'}
                </Gloss>
              </div>
              <FooterCaption className="reserve-exit">{say(identity.oneLiner)}</FooterCaption>
            </Region>

            <Region className="justify-between gap-4">
              <Card>
                <Eyebrow className="text-dim" size={9.5} tracking="0.22em">
                  {winners.length === 0 ? 'No sale' : 'Bought and paid for'}
                </Eyebrow>
                <Impact size={26} className="mt-2 text-ivory">
                  {winners.length === 0 ? 'Nobody bid' : names}
                </Impact>
                <p className="mt-2 font-body text-[13.5px] leading-[1.5] text-warm desktop:text-[15px]">
                  {winners.length === 0
                    ? 'This one passes with no winner.'
                    : 'They answer alone, for ' + winners[0].bid + ' points. Here is what they bought.'}
                </p>
              </Card>
              <LiveNote>Waiting on the room</LiveNote>
            </Region>
          </div>
        </Screen>
      )
    }
  }

  // WAGER ROUND: bet first, and only then see the question.
  const needsWager = roundType.hasWager && !roundType.needsBidding && (!myAnswer || myAnswer.wager == null)
  if (needsWager) {
    return (
      <WagerStep
        game={game}
        meId={meId}
        me={me}
        roundType={roundType}
        identity={identity}
        busy={busy}
        onSetWager={onSetWager}
      />
    )
  }

  // The chrome every state of this screen carries: the status strip at the very
  // top and the red ledger band under it. Both belong to the shell rather than to
  // the content region - they are full bleed, and a screen that renders them
  // inline has to cancel its own gutter with a negative margin to get there,
  // which broke every time a screen's padding changed.
  const chrome = {
    status: {
      left: <Clock />,
      right: <PlayerTag badgeNo={badgeNo} badge={badge} />,
    },
    band: (
      <RoundBand
        roundType={roundType}
        position={position}
        ledger={ledger.number - 1}
        secondsLeft={secondsLeft}
      />
    ),
    footer: {
      left: me ? 'Signed in as ' + me.displayName + ' · badge ' + badgeNo : 'Signed in',
      right: game.roomCode,
    },
  }

  // The question and its hint, which every answering state opens with.
  const prompt = (
    <>
      {/* The question sizes itself from its own length - see typeFit.js. A long
          one wraps downwards and shrinks rather than running off the bottom of
          the phone.

          The rank and number rounds ask for an even gentler desktop scale than
          `Title`'s own default, because each has a TALL input sharing the
          column with the question - five draggable rows and a button for
          rank, a label, a display box, a 4-row keypad and a button for number
          - so the question does not own its column the way it does everywhere
          else. */}
      <Title scale={roundType.key === 'rank' || roundType.key === 'number' ? 1.15 : undefined}>
        {question.text}
      </Title>

      <Gloss>{say(HINTS[roundType.key] || roundType.blurb)}</Gloss>

      {roundType.hasWager && myAnswer && myAnswer.wager != null && (
        <p
          className="border-t-2 border-rule pt-3 font-mono text-[11px] font-bold uppercase
                     text-red-bright desktop:text-[13px]"
          style={{ letterSpacing: '0.16em' }}
        >
          {myAnswer.wager} point{myAnswer.wager === 1 ? '' : 's'} riding on this
        </p>
      )}
    </>
  )

  // Time's up and this phone never filed anything. Shown ahead of every other
  // state below - there is nothing left to wait on here except the room.
  if (expired && !(myAnswer && myAnswer.submitted)) {
    return <TooSlow />
  }

  // Already answered: show it back and wait.
  if (myAnswer && myAnswer.submitted) {
    return (
      <Screen fixed pad={false} {...chrome}>
        <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_380px]">
          <Region edge="right" className="gap-4">
            {prompt}
          </Region>
          <Region className="justify-between gap-5">
            <Card>
              <Eyebrow className="text-dim" size={9.5} tracking="0.22em">
                Filed
              </Eyebrow>
              <div className="mt-2.5">
                <SubmittedAnswer answer={myAnswer} />
              </div>
            </Card>

            <div className="reserve-exit flex flex-col gap-2.5">
              <LiveNote>Waiting on everyone else</LiveNote>
              <FooterCaption>{say(identity.oneLiner)}</FooterCaption>
            </div>
          </Region>
        </div>
      </Screen>
    )
  }

  function handleSubmit(payload) {
    setError('')
    onSubmitAnswer(payload)
  }

  // FILED SO FAR - the same "who is actually expected to answer this
  // question" logic `QuestionScreenHost.jsx` already uses for its own
  // progress count (auction losers and a Levelling target don't count
  // against the total; both have already returned a different screen above
  // by this point, so `meId` itself is always one of the expected players
  // here). Per bundle 2's own "Ledger I input" frame, shown next to the timer
  // rather than left for the host's screen alone to know.
  const filedAnswers = answersForQuestion(game, question.id)
  const filedLeveledOutId = cardsPlayedOn(game, question.id).find(
    (card) => card.key === 'levelling',
  )?.targetPlayerId
  const filedExpected = (
    roundType.needsBidding
      ? auctionWinners(filedAnswers)
          .map((answer) => findPlayer(game, answer.playerId))
          .filter(Boolean)
      : activePlayers(game)
  ).filter((player) => player.id !== filedLeveledOutId)
  const filedCount = filedAnswers.filter((answer) => answer.submitted).length

  return (
    <Screen fixed pad={false} {...chrome}>
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_380px]">
        <Region edge="right" className="min-h-0 gap-4">
          {/* Deliberately NOT flex-1/min-h-0/overflow-y-auto: that combination
              let flexbox shrink this box - the question itself - down to a
              sliver whenever the control below it (the number pad, the rank
              list) was tall enough to want the room. The question must never
              be the thing that loses that fight. It now takes its natural
              height; if the two together are still taller than the window,
              the Region's own overflow (or the Screen's page-level fallback
              on a phone) scrolls the whole column instead, starting at the
              top - so the question is always the FIRST thing on screen,
              never the thing quietly compressed to nothing. */}
          <div className="flex flex-col gap-4">
            {prompt}

            {/* Cards you can spend before answering. Renders nothing if your
                hand is empty, which is most rounds.

                PHONE ONLY. Stacked above the answer box it is 269px in a 360px
                box it shares with the question, and the cards came out sliced
                in half behind a scrollbar - a player could not read what any of
                them did. On a laptop it moves to the rail, which was carrying a
                count and one line of blurb and had the room. Same duplicate-and
                -toggle the timer row above already uses: only one is ever
                displayed, so only one is ever clickable. */}
            <div className="desktop:hidden">
              <PowerUpHand
                game={game}
                meId={meId}
                hand={handFor(game, meId, currentCategory(game)?.id)}
                onPlay={onPlayPowerUp}
              />
            </div>
          </div>

          <div className="shrink-0">
            {/* The timer and the filed count live in the right-hand rail on a
                laptop, where there is room for them. On a phone there is no
                rail, so they sit as one short row directly above the input -
                which is also the order a thumb reads them in. */}
            <div className="mb-3 flex gap-2 desktop:hidden">
              {secondsLeft !== null && <TimeLeft secondsLeft={secondsLeft} className="flex-1" />}
              {filedExpected.length > 0 && (
                <div className="flex-1 border border-rule border-l-[5px] border-l-red bg-panel px-3.5 py-3">
                  <Eyebrow className="text-dim" size={9.5} tracking="0.22em">
                    Filed so far
                  </Eyebrow>
                  <div className="flex items-baseline gap-2">
                    <span className="font-impact text-[30px] text-ivory tabular-nums">
                      {filedCount}
                    </span>
                    <span className="font-mono text-[13px] text-dim">
                      of {filedExpected.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <ErrorBanner message={error} />
            <AnswerInput
              roundType={roundType}
              question={question}
              badgeNo={badgeNo}
              detectiveName={me?.displayName}
              // The staked rounds put their bidding/betting words on the round's
              // call to action, which is right on the screen where you bid or
              // bet. On THIS screen the bidding is over and you are submitting
              // an answer, so a button reading "Place your bid" was describing
              // something that already happened.
              cta={roundType.needsBidding || roundType.hasWager ? 'Submit your answer' : identity.cta}
              busy={busy}
              onError={setError}
              onSubmit={handleSubmit}
            />
          </div>
        </Region>

        <Region className="hidden justify-between gap-4 desktop:flex">
          <div className="flex flex-col gap-3.5">
            {secondsLeft !== null && <TimeLeft secondsLeft={secondsLeft} />}

            {/* The desktop home of the hand - see the note beside its phone
                copy in the left column. */}
            <PowerUpHand
              game={game}
              meId={meId}
              hand={handFor(game, meId, currentCategory(game)?.id)}
              onPlay={onPlayPowerUp}
            />

            {filedExpected.length > 0 && (
              <div className="border border-rule bg-panel px-4 py-3.5">
                <Eyebrow className="text-dim" size={10} tracking="0.22em">
                  Filed so far
                </Eyebrow>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <span className="font-impact text-[44px] leading-none text-ivory tabular-nums">
                    {filedCount}
                  </span>
                  <span className="font-mono text-[16px] text-dim">of {filedExpected.length}</span>
                </div>
              </div>
            )}

            <p className="font-body text-[15px] leading-[1.55] text-warm">{say(roundType.blurb)}</p>
          </div>

          <FooterCaption className="reserve-exit">{say(identity.oneLiner)}</FooterCaption>
        </Region>
      </div>
    </Screen>
  )
}

// Picks the right control for the round.
function AnswerInput({ roundType, question, cta, badgeNo, detectiveName, busy, onError, onSubmit }) {
  const say = useSay()
  if (roundType.inputType === 'number') {
    return <NumberPad cta={cta} busy={busy} onError={onError} onSubmit={onSubmit} />
  }
  if (roundType.inputType === 'rank') {
    return <RankAnswerInput question={question} cta={cta} busy={busy} onSubmit={onSubmit} />
  }
  // The nudge in the empty answer box comes from the prompt pool, picked from
  // the question id so it is the same on every phone and does not change while
  // somebody is staring at it.
  return (
    <TextInput
      roundType={roundType}
      cta={cta}
      badgeNo={badgeNo}
      detectiveName={detectiveName}
      busy={busy}
      placeholder={say(pickFrom(TYPED_PROMPTS, question.id))}
      onError={onError}
      onSubmit={onSubmit}
    />
  )
}

// A small uppercase label, used above every control on this screen.
function FieldLabel({ children }) {
  return (
    <Eyebrow className="mb-2 text-dim" size={10} tracking="0.18em">
      {children}
    </Eyebrow>
  )
}

// Bone ground, not the room's dark - per the design's own rule that anything
// a player typed is "evidence... on the record", and reads in Courier for the
// same reason ("the text of anything a player typed... reads as
// typewritten evidence"). Matches bundle 2's own "STATEMENT OF <name>"
// panel; `badgeNo`/`detectiveName` are optional so this still renders sanely
// if either is somehow unavailable.
function TextInput({ roundType, cta, badgeNo, detectiveName, busy, placeholder, onError, onSubmit }) {
  const [draft, setDraft] = useState('')
  const limit = roundType.maxLength || 0

  // The box grows as the answer does, so a long one is readable in full while
  // it is being written. See useGrowingBox.js for why.
  const box = useGrowingBox(draft)

  function submit() {
    const clean = draft.trim()
    if (clean === '') {
      onError('Type something first. A guess still counts.')
      return
    }
    onSubmit({ text: clean })
  }

  const label =
    roundType.key === 'pitch' ? 'Your pitch' : roundType.key === 'fib' ? 'Your lie' : 'Your answer'

  return (
    <>
      <FieldLabel>{label}</FieldLabel>

      {/* The answer well. Paper, and lifted on a hard offset shadow, because
          what you type here is evidence going on the record - the one thing on
          a live-play screen the design lets off the dark ground.
          Deliberately NOT pinned or tilted, which is the rest of the paper
          treatment: the bundle's own answer well is the one paper surface it
          draws flat, and a pin sitting over a text field you are typing into
          would be in the way rather than decorative. */}
      <div className="bg-paper px-4 pt-3.5 pb-4 text-ink shadow-lift-md">
        <div
          className="flex justify-between font-mono text-[9px] font-bold uppercase text-red-deep desktop:text-[10px]"
          style={{ letterSpacing: '0.2em' }}
        >
          <span className="truncate">
            Statement of {detectiveName ? 'Det. ' + detectiveName : 'the detective'}
          </span>
          {badgeNo && <span className="shrink-0">No. {badgeNo}</span>}
        </div>

        <textarea
          ref={box}
          value={draft}
          onChange={(event) => setDraft(limit > 0 ? event.target.value.slice(0, limit) : event.target.value)}
          rows={3}
          autoFocus
          placeholder={placeholder}
          className="paper-field focus-ring caret-red mt-2.5 min-h-[92px] w-full resize-none
                     overflow-hidden border-2 border-red px-3.5 py-3 font-mono text-[16px]
                     leading-[1.5] text-ink placeholder:text-ink-faint desktop:min-h-[130px]
                     desktop:text-[17px]"
        />

        {limit > 0 && (
          <div
            className="mt-2.5 flex justify-between border-t-2 border-ink/70 pt-[7px] font-mono
                       text-[9.5px] font-bold uppercase desktop:text-[10px]"
            style={{ letterSpacing: '0.16em' }}
          >
            <span>Spelling isn&rsquo;t scored</span>
            <span className="tabular-nums">
              {draft.length}/{limit}
            </span>
          </div>
        )}
      </div>

      {/* Saying "Sending…" and going flat is the whole point. On a slow phone
          the round trip takes a second or two, and a button that looks
          completely untouched gets tapped three more times. */}
      <div className="mt-3.5">
        <BigButton onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : cta}
        </BigButton>
      </div>
      <p
        className="mt-3 font-mono text-[9.5px] font-bold uppercase text-dim desktop:text-[10px]"
        style={{ letterSpacing: '0.2em' }}
      >
        Once filed, it is evidence. No taking it back.
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// The number pad. Not a text input, and deliberately not the browser's number
// field either: on a phone that opens a keyboard which covers half the screen
// and still lets you type letters.
//
// The numerals are Space Grotesk 700 rather than the display face. IM Fell has
// old-style figures - its zero reads as a lowercase o and its one as a dotless
// i - which is unusable on the one control whose entire job is entering a
// number. This is the single exception to the type rules.
// ---------------------------------------------------------------------------
// Six, not four. Four capped a guess at 9999, which was fine when the questions
// were all "how many countries" - but the bank asks how many photos are on her
// phone and how many messages are unread, and the honest answers to those run
// to five figures. The guest of honour types their own answer in a free text
// field with no
// such cap, so a four digit pad meant she could answer 12,000 and no player in
// the room could physically guess near it. Six digits covers every question in
// the bank with room to spare.
const MAX_DIGITS = 6

function NumberPad({ cta, busy, onError, onSubmit }) {
  const [draft, setDraft] = useState('')

  function press(digit) {
    if (draft.length >= MAX_DIGITS) return
    // Never build "007". A leading zero is replaced by whatever comes next.
    setDraft(draft === '0' ? digit : draft + digit)
  }

  function backspace() {
    setDraft(draft.slice(0, -1))
  }

  function submit() {
    if (draft === '') {
      onError('Tap a number first. Any number beats no number.')
      return
    }
    onSubmit({ number: Number(draft), text: draft })
  }

  return (
    <>
      <FieldLabel>Your guess</FieldLabel>

      <div className="border border-line bg-panel px-4 py-3.5 text-center">
        {draft === '' ? (
          // A word, not a dash. A dash in an outlined box reads as a stray rule
          // and people wonder whether the screen has finished loading.
          <span className="block py-2 font-mono text-[20px] desktop:text-[26px] text-dim">Tap a number</span>
        ) : (
          <span
            className="block font-mono text-ivory tabular-nums"
            // Six digits at 56px overflows a 375px phone, so the numeral steps
            // down once the number gets long rather than running off the box.
            style={{ fontSize: draft.length >= 5 ? '40px' : '56px', lineHeight: 1.1 }}
          >
            {draft}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <PadKey key={digit} onClick={() => press(digit)}>
            {digit}
          </PadKey>
        ))}

        <PadKey onClick={backspace} label="Delete the last digit">
          &#8592;
        </PadKey>
        <PadKey onClick={() => press('0')}>0</PadKey>
        <PadKey onClick={submit} label="Lock in this number" tone="accent">
          &#10003;
        </PadKey>
      </div>

      <div className="mt-4">
        <BigButton onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : cta}
        </BigButton>
      </div>
      <p className="mt-3 text-center text-[13px] desktop:text-[17px] text-dim">Up to six digits.</p>
    </>
  )
}

function PadKey({ children, onClick, label, tone = 'plain' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'focus-ring min-h-[54px] border font-mono text-[19px] desktop:text-[24px] ' +
        (tone === 'accent'
          ? 'border-red bg-red text-bone'
          : 'border-line bg-panel text-ivory')
      }
    >
      {children}
    </button>
  )
}

function RankAnswerInput({ question, cta, busy, onSubmit }) {
  // Start from a shuffled order so nobody gets a free head start from the
  // order the question happened to be written in.
  const [order, setOrder] = useState(() => shuffle(question.items || []))

  return (
    <>
      <FieldLabel>Your order</FieldLabel>
      <RankInput items={order} onChange={setOrder} />

      <div className="mt-5">
        <BigButton onClick={() => onSubmit({ order })} disabled={busy}>
          {busy ? 'Sending…' : cta}
        </BigButton>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// The betting step that runs before a wager question is revealed. The panel
// inverts to ink, because this is the one moment in the night where you are
// deciding something without being able to see what you are deciding about.
//
// The standings sit right above the bet, on the same screen - ROUNDS.md asks
// for the leaderboard to be visible before betting, and betting blind on your
// own score without seeing anyone else's is a guess, not a decision.
// ---------------------------------------------------------------------------
function WagerStep({ game, meId, me, roundType, identity, busy, onSetWager }) {
  const say = useSay()
  const maxWager = me ? Math.max(0, me.score) : 0
  const [amount, setAmount] = useState(0)
  const badge = currentBadgeFor(game, meId)
  const badgeNo = badgeNumberFor(game, meId)

  return (
    <Screen
      fixed
      pad={false}
      status={{ left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }}
      band={<RoundBand roundType={roundType} />}
      footer={{ left: 'Bet before you see it', right: game.roomCode }}
    >
      {/* TWO REGIONS, not a stack. This was the last screen in the app still
          laid out as one column stretched across a laptop, and it showed: a
          player's name and their score sat 1300px apart with nothing between
          them, and the whole thing finished halfway down the window.

          The split is the decision itself. You are betting blind, so the only
          thing worth looking at is where everyone stands - that is the left
          region, given the room to be a real table. The bet and the button are
          the right one. A rule between them rather than a gap, which is the
          difference between a desktop screen and two phone screens side by
          side. */}
      {/* 540px, not less: "Confirm your wager" wrapped onto two lines inside a
          460px column, and a primary button that wraps reads as a mistake. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_540px]">
        <Region className="gap-3.5">
          <Eyebrow className="shrink-0 text-dim" size={10} tracking="0.18em">
            Standings, before you bet
          </Eyebrow>
          <div>
            <Standings entries={rankedPlayers(game)} meId={meId} isHost={false} />
          </div>
        </Region>

        <Region edge="left" className="justify-between gap-5">
          <StakePanel
            label="Place your bet first"
            amount={amount}
            max={maxWager}
            onChange={setAmount}
            footnote="You have not seen the question. That is the entire idea."
          />

          <div className="flex flex-col gap-4">
            <BigButton onClick={() => onSetWager(amount)} disabled={busy}>
              {busy ? 'Sending…' : identity.cta}
            </BigButton>
            <div className="flex justify-center">
              <OneLiner>{say(identity.oneLiner)}</OneLiner>
            </div>
          </div>
        </Region>
      </div>
    </Screen>
  )
}

// Shows a submitted answer back to the player in the right shape, so they can
// see it landed.
function SubmittedAnswer({ answer }) {
  if (answer.order && answer.order.length > 0) {
    return (
      <ol className="flex flex-col gap-2">
        {answer.order.map((item, index) => (
          <li
            key={item}
            className="flex min-h-[48px] items-center gap-3 border border-line bg-panel px-3.5 py-2.5"
          >
            <span className="grid h-[28px] w-[28px] shrink-0 place-items-center border border-red font-mono text-[13px] desktop:text-[17px] text-red">
              {index + 1}
            </span>
            <span className="min-w-0 text-[15px] desktop:text-[19px] text-ivory">{item}</span>
          </li>
        ))}
      </ol>
    )
  }

  return (
    // Courier, not the body face - the design's own rule for anything a
    // player typed: it reads back as typewritten evidence, not prose.
    <p className="border border-line bg-panel px-3.5 py-3 font-mono text-[16px] desktop:text-[20px] break-words text-ivory">
      {answer.text || 'You did not answer this one.'}
    </p>
  )
}
