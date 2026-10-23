import JoinScreen from './JoinScreen.jsx'
import LoadingScreen from './LoadingScreen.jsx'
import HostSetupScreen from './HostSetupScreen.jsx'
import LobbyScreen from './LobbyScreen.jsx'
import BiddingScreen from './BiddingScreen.jsx'
import QuestionScreenHost from './QuestionScreenHost.jsx'
import QuestionScreenPlayer from './QuestionScreenPlayer.jsx'
import VotingScreen from './VotingScreen.jsx'
import JudgingScreen from './JudgingScreen.jsx'
import RevealScreen from './RevealScreen.jsx'
import CategoryResultsScreen from './CategoryResultsScreen.jsx'
import FinalLeaderboard from './FinalLeaderboard.jsx'
import WaitingScreen, { MARKS as WAITING_MARKS } from './WaitingScreen.jsx'
import { answerFor } from '../gameHelpers.js'
import { fill, subjectFrom } from '../subject.js'

// ---------------------------------------------------------------------------
// GameRouter - picks which screen to show for the game's current status, and
// wires it up with every handler that screen needs. Split out of `App.jsx`,
// where this used to be a function called `renderScreen` sharing App's own
// closure directly; here the same 43 things App already builds (state,
// derived values, and every action handler) arrive as props instead. Nothing
// about WHAT gets shown or WHICH handler fires changed in the move - only
// where the variables live.
// ---------------------------------------------------------------------------

export default function GameRouter(props) {
  const {
    game,
    isHost,
    meIsInGame,
    joining,
    meId,
    busy,
    pendingCounts,
    handleJoin,
    toggleCategory,
    setQuestionCount,
    toggleLoserSupport,
    setPowerUpTier,
    setSubject,
    addOwnQuestion,
    editQuestion,
    removeQuestion,
    openLobby,
    deleteThisGame,
    startGame,
    backToEditor,
    submitBid,
    lockBids,
    startTimer,
    extendTimer,
    clearTimer,
    lockAnswers,
    nextQuestion,
    setTrueOrder,
    setTrueNumber,
    setTrueAnswer,
    submitAnswer,
    setWager,
    playPowerUp,
    submitVote,
    lockVotes,
    setPoints,
    pickWinner,
    finishJudging,
    nextCategory,
    endGame,
    removePlayer,
    setPowerUpAward,
    forgetMe,
  } = props

    // A player the host dropped still has a row in `players` - dropping
    // switches them off rather than deleting them, on purpose, so their old
    // answers stay put - so `meIsInGame` alone can't tell a dropped player
    // from an active one. Without this, they kept seeing the live game and
    // could still submit answers that went nowhere, with nothing telling them
    // why (AUDIT.md finding 28).
    // `joining` matters here too. Rejoining switches an existing player back
    // on, so for the moment between being recognised and the reload landing,
    // this browser knows who it is and the game still says that person is
    // switched off - which flashed "You've Been Taken Off the Board" at
    // somebody whose phone had simply died and who was on their way back in.
    if (!isHost && meIsInGame && !joining) {
      const me = game.players.find((p) => p.id === meId)
      if (me && me.active === false) {
        return (
          <WaitingScreen
            mark={WAITING_MARKS.hourglass}
            title="You've Been Taken Off the Board"
            message="The host dropped you from this game - probably because you went quiet. Your score is kept. Tap &quot;Wrong room?&quot; below, then rejoin with the same name to get back in."
            oneLiner="Nothing you do here reaches anyone"
            roomCode={game.roomCode}
          />
        )
      }
    }

    // A player who hasn't joined yet (or whose saved id is stale) needs a name.
    // Not while a join is actually in flight, though - see `handleEnterRoom`.
    if (!isHost && !meIsInGame) {
      if (joining) return <LoadingScreen message="Taking your seat..." />
      return (
        <JoinScreen
          expectedRoomCode={game.roomCode}
          existingNames={game.players.map((p) => p.displayName)}
          busy={busy}
          onJoin={(name) => handleJoin(name)}
        />
      )
    }

    if (game.status === 'setup') {
      if (!isHost) {
        return (
          <WaitingScreen
            mark={WAITING_MARKS.hourglass}
            title="Not Quite Ready"
            message="The host is still setting up the rounds. Hang tight."
            oneLiner="The precinct is still filling up · Nobody is late yet"
          />
        )
      }
      return (
        <HostSetupScreen
          game={game}
          pendingCounts={pendingCounts}
          onToggleCategory={toggleCategory}
          onSetQuestionCount={setQuestionCount}
          onToggleLoserSupport={toggleLoserSupport}
          onSetPowerUpTier={setPowerUpTier}
          onSetSubject={setSubject}
          onAddOwnQuestion={addOwnQuestion}
          onEditQuestion={editQuestion}
          onRemoveQuestion={removeQuestion}
          onOpenLobby={openLobby}
          onDeleteGame={deleteThisGame}
        />
      )
    }

    if (game.status === 'lobby') {
      return (
        <LobbyScreen
          game={game}
          isHost={isHost}
          meId={meId}
          onStart={startGame}
          onBackToEditor={backToEditor}
        />
      )
    }

    if (game.status === 'bidding') {
      return (
        <BiddingScreen
          // Keyed for the same reason as the question screens below: it holds
          // a bid amount, and no bid may survive into another question.
          key={game.currentQuestionId}
          game={game}
          isHost={isHost}
          meId={meId}
          onSubmitBid={submitBid}
          onLockBids={lockBids}
          onStartTimer={startTimer}
          onExtendTimer={extendTimer}
          onClearTimer={clearTimer}
        />
      )
    }

    // KEYED BY THE QUESTION, both of them.
    //
    // These screens hold local state seeded from the question: the judge's
    // working ranking, a player's shuffled ranking, half-typed answers, a
    // wager. A seeded useState only runs its initialiser when the component
    // MOUNTS, so that state has to be thrown away when the question changes.
    //
    // Normally it is, because every question passes through judging and reveal
    // on its way to the next one, and the screen unmounts. Skip is the one move
    // that goes question_open straight to question_open - React then reuses the
    // component, the heading updates because it reads the new question, and the
    // ranking underneath is still the last question's list. Which is exactly
    // what it looked like: "Rank these drinks" above five household chores.
    //
    // Keying by the question id makes the question the component's identity, so
    // a new question is a new component with nothing carried over.
    if (game.status === 'question_open') {
      return isHost ? (
        <QuestionScreenHost
          key={game.currentQuestionId}
          game={game}
          onLockAnswers={lockAnswers}
          onSkipQuestion={nextQuestion}
          onSetTrueOrder={setTrueOrder}
          onSetTrueNumber={setTrueNumber}
          onSetTrueAnswer={setTrueAnswer}
          onStartTimer={startTimer}
          onExtendTimer={extendTimer}
          onClearTimer={clearTimer}
        />
      ) : (
        <QuestionScreenPlayer
          key={game.currentQuestionId}
          game={game}
          meId={meId}
          busy={busy}
          onSubmitAnswer={submitAnswer}
          onSetWager={setWager}
          onPlayPowerUp={playPowerUp}
        />
      )
    }

    if (game.status === 'voting') {
      return (
        <VotingScreen
          game={game}
          isHost={isHost}
          meId={meId}
          onSubmitVote={submitVote}
          onLockVotes={lockVotes}
          onStartTimer={startTimer}
          onExtendTimer={extendTimer}
          onClearTimer={clearTimer}
        />
      )
    }

    if (game.status === 'judging') {
      if (isHost) {
        return (
          <JudgingScreen
            game={game}
            onSetPoints={setPoints}
            onPickWinner={pickWinner}
            onFinishJudging={finishJudging}
          />
        )
      }

      // TOLD, RATHER THAN LEFT TO WORK IT OUT.
      //
      // `QuestionScreenPlayer` has a "you were too slow" state and it was
      // effectively unreachable: when a host timer runs out the host's screen
      // locks the answers automatically, which moves the whole game to judging
      // a fraction of a second before the player's own screen can show it. The
      // second audit watched somebody typing when the clock ran out get sent
      // straight to "The Judge Is Reading", with their half-written answer gone
      // and nothing anywhere saying it had not counted.
      //
      // So the waiting screen says it instead. Same screen, same shape - only
      // the words change, and only for the people it is actually true of.
      const mine = answerFor(game, game.currentQuestionId, meId)
      const missedIt = !(mine && mine.submitted)

      return (
        <WaitingScreen
          mark={WAITING_MARKS.scales}
          title={missedIt ? 'Your Statement Never Landed' : 'The Judge Is Reading'}
          message={
            missedIt
              ? fill(
                  'Time ran out before yours was filed, so there is nothing of yours to read. Nothing scores this question. The next one is yours to take.',
                  subjectFrom(game),
                )
              : fill("{Name} is looking at everyone's answers right now.", subjectFrom(game))
          }
          oneLiner={
            missedIt
              ? 'The clock does not take statements · It only takes time'
              : fill('{They} cannot see your name · {They} may guess it', subjectFrom(game))
          }
          game={game}
          meId={meId}
          roomCode={game.roomCode}
        />
      )
    }

    if (game.status === 'reveal') {
      return (
        <RevealScreen
          game={game}
          isHost={isHost}
          meId={meId}
          onNextQuestion={nextQuestion}
          onSetPowerUpAward={setPowerUpAward}
          onRemovePlayer={removePlayer}
        />
      )
    }

    if (game.status === 'category_results') {
      return (
        <CategoryResultsScreen
          // Keyed by the question, same reasoning as the question screens
          // above: this screen now holds its own local state (the rank-card
          // interstitial, the film-leader transition) seeded once at mount
          // from the round that just finished. Without a key here, moving
          // from one round's results to the next would reuse the same
          // component instance and that seeded state would never refresh -
          // the rank card would only ever have been able to show once, on
          // the very first round of the night.
          key={game.currentQuestionId}
          game={game}
          isHost={isHost}
          meId={meId}
          onNextCategory={nextCategory}
          onEndGame={endGame}
          onRemovePlayer={removePlayer}
        />
      )
    }

    if (game.status === 'finished') {
      return (
        <FinalLeaderboard
          game={game}
          isHost={isHost}
          meId={meId}
          onPlayAgain={forgetMe}
          onDeleteGame={deleteThisGame}
        />
      )
    }

    return <UnknownState status={game.status} onReset={forgetMe} />
}


// A safety net - if the game ever ends up in a state we don't recognise, say
// so clearly instead of showing nothing.
function UnknownState({ status, onReset }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-board p-6 text-ivory">
      <div className="max-w-md rounded-2xl border border-dim/50 bg-dim/15 p-6 text-center">
        <p className="mb-2 text-lg font-semibold">Something unexpected happened</p>
        <p className="mb-4 text-ivory">
          The game is in a state called &quot;{String(status)}&quot;, which this screen doesn&apos;t
          know how to show. Nothing is broken, just start over.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl bg-panel/12 px-5 py-3 font-semibold hover:bg-panel/15"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
