import { useState, useEffect } from 'react'
import {
  Screen,
  Region,
  HeadlineBand,
  Title,
  Plate,
  PanelHeading,
  BigButton,
  RankCard,
  LedgerDots,
} from '../ui.jsx'
import {
  currentCategory,
  categoryPosition,
  categoryLeaderboard,
  categoryLosers,
  rankedPlayers,
  isLastCategory,
  firstQuestionOfNextCategory,
  findCategory,
  handFor,
} from '../gameHelpers.js'
import { ROUND_TYPES } from '../roundTypes.js'
import { identityFor, ledgerNumeral } from '../roundIdentity.js'
import { badgeMovesForRound, earnsRankCard } from '../badge.js'
import { findCard } from '../powerUps.js'
import PowerCard from '../components/PowerCard.jsx'
import ScoreAdjuster from '../components/ScoreAdjuster.jsx'
import Standings from '../components/Standings.jsx'
import { FilmLeader } from './LoadingScreen.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// ROUND RESULTS - 3G in the design bundle - shown at the end of each ledger.
//
// Two leaderboards side by side: how this round went on its own, and where
// that leaves the night overall. Points carry over as raw points, so the
// round board is a slice of the overall one rather than a separate currency.
//
// THIS IS WHERE THE BADGE SYSTEM FINALLY GETS SHOWN. `badge.js` was built and
// tested from the start of the design pass, and until this screen nothing on
// screen ever actually rendered a rank moving - not a status-bar chip, not a
// "UP ONE" suffix, not the rank card. All three land here: the round board
// carries the suffix (via `Standings`' own `badgeMoves` prop), and if THIS
// device's own player moved, the full-screen `RankCard` interstitial plays
// for a beat before the results underneath it are shown at all.
//
// It is also where the mercy card is handed out, and it shows the ACTUAL
// cards that were dealt rather than promising something vague. The deal has
// already happened by the time this screen appears, so there is no reason to
// be coy about it - the person who came last should be able to read what
// they got.
//
// The headline never names a winner. It is fixed copy, because a round where
// nobody scored is a real outcome and a headline that has to cope with it
// ends up saying something limp.
// ---------------------------------------------------------------------------

// "Ana", "Ana and Bo", "Ana, Bo and Cal" - reads like a person wrote it.
function joinNames(names) {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return names[0] + ' and ' + names[1]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

function ordinal(n) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return n + 'th'
  const mod10 = n % 10
  if (mod10 === 1) return n + 'st'
  if (mod10 === 2) return n + 'nd'
  if (mod10 === 3) return n + 'rd'
  return n + 'th'
}

export default function CategoryResultsScreen({
  game,
  isHost,
  meId,
  onNextCategory,
  onEndGame,
  onRemovePlayer,
}) {
  const say = useSay()
  const category = currentCategory(game)
  const position = categoryPosition(game)
  const lastOne = isLastCategory(game)

  // The round that just finished, zero-based - `currentQuestionId` has not
  // moved on yet at this point in the state machine, so `position.number` is
  // still the round this screen is reporting on.
  const roundIndex = position.number - 1
  const moves = badgeMovesForRound(game, roundIndex)
  const myMove = !isHost && meId ? moves[meId] : null

  // THE RANK CARD. A full-screen interstitial, shown once, only on the device
  // of whoever's own badge actually moved this round - never for a held
  // badge, which is the common case, and never for the host, who has no
  // badge to move. Dismisses itself after a beat, exactly as the design asks.
  const [showRankCard, setShowRankCard] = useState(() => earnsRankCard(myMove))
  useEffect(() => {
    if (!showRankCard) return
    const timer = setTimeout(() => setShowRankCard(false), 2600)
    return () => clearTimeout(timer)
  }, [showRankCard])

  // THE TRANSITION. A brief between-ledgers beat on the host's own screen when
  // they move the game along - the `FilmLeader` built for exactly this and,
  // per its own comment, never wired in anywhere until now. Local to this
  // device only: the other phones simply see "waiting for the next round…"
  // for the same stretch of time, which is what already happened before this
  // existed, so nothing about the shared game state needs to know about it.
  const [transition, setTransition] = useState(null) // null | 'next' | 'finish'
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!transition) return
    setProgress(0)
    const start = Date.now()
    const duration = 1100
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min(1, elapsed / duration))
    }, 40)
    const finish = setTimeout(() => {
      if (transition === 'finish') onEndGame()
      else onNextCategory()
    }, duration)
    return () => {
      clearInterval(tick)
      clearTimeout(finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition])

  if (showRankCard && myMove) {
    const ranked = rankedPlayers(game)
    const me = ranked.find((player) => player.id === meId)
    return (
      <RankCard
        move={myMove}
        points={me ? me.score : 0}
        standing={me ? ordinal(me.rank) + ' of ' + ranked.length : ''}
      />
    )
  }

  if (transition) {
    const upcoming = transition === 'next' ? firstQuestionOfNextCategory(game) : null
    const nextCategory = upcoming ? findCategory(game, upcoming.categoryId) : null
    const nextRoundType = nextCategory ? ROUND_TYPES[nextCategory.type] || ROUND_TYPES.typed : null
    const nextIdentity = nextRoundType ? identityFor(nextRoundType.key) : null
    const activeCategoryList = game.categories.filter((c) => c.included !== false)
    const nextIndex = nextCategory
      ? activeCategoryList.findIndex((c) => c.id === nextCategory.id)
      : -1

    return (
      <FilmLeader
        // "Ledger <this> of <however many are actually running tonight>" -
        // per bundle 2's own "Film leader" frame, but the total is read live
        // rather than hardcoded at VIII, since every ledger is optional and a
        // host can bench any of them at setup.
        exhibit={
          transition === 'finish'
            ? 'Closing the file'
            : nextIndex >= 0
              ? `Ledger ${ledgerNumeral(nextIndex)} of ${ledgerNumeral(activeCategoryList.length - 1)}`
              : ''
        }
        ledgerName={transition === 'finish' ? 'Case closed' : nextRoundType ? say(nextRoundType.label) : ''}
        tagline={nextIdentity ? say(nextIdentity.oneLiner) : undefined}
        progress={progress}
        standingBy={transition === 'finish' ? 'Tallying the night' : 'Dealing the next ledger'}
        roomCode={game.roomCode}
        ledgerIndex={transition === 'finish' ? activeCategoryList.length : nextIndex}
        ledgerTotal={activeCategoryList.length}
      />
    )
  }

  if (!category) {
    return (
      <Screen maxWidth={860} desktopMaxWidth={1100} centerY={false} roomCode={game.roomCode}>
        <Plate hero className="p-5">
          <p className="text-center text-[15px] desktop:text-[19px] text-dim">No ledger to show.</p>
          {isHost && (
            <div className="mt-4">
              <BigButton onClick={onEndGame}>Go to the closing scoreboard</BigButton>
            </div>
          )}
        </Plate>
      </Screen>
    )
  }

  const roundType = ROUND_TYPES[category.type] || ROUND_TYPES.typed
  const board = categoryLeaderboard(game, category.id)
  const overall = rankedPlayers(game)

  // The mercy cards were dealt for the round COMING UP, so there is nothing to
  // show on the last round of the night - and nothing to show when the round
  // coming up is a Power-Up Quiz either, since App.jsx's `grantLoserSupport`
  // deliberately skips dealing one for that case (it already has its own
  // deck in play; see the comment there). Showing "waiting for them in the
  // next round" when no card is actually coming would be a promise the app
  // does not keep.
  const upcoming = firstQuestionOfNextCategory(game)
  const nextCategoryId = upcoming ? upcoming.categoryId : null
  const nextCategory = nextCategoryId ? findCategory(game, nextCategoryId) : null
  const nextIsPowerUp = Boolean(nextCategory && nextCategory.type === 'powerup')
  const losers =
    game.loserSupportEnabled && nextCategoryId && !nextIsPowerUp
      ? categoryLosers(game, category.id)
      : []
  const handouts = losers.flatMap((loser) =>
    handFor(game, loser.id, nextCategoryId)
      .map((held) => ({ id: held.id, card: findCard(held.key) }))
      .filter((entry) => entry.card),
  )

  return (
    <Screen
      fixed
      pad={false}
      status={{
        left: say(roundType.label) + ' · filed',
        right: 'Case ' + game.roomCode,
      }}
      footer={{
        left: say('Points are final · unless {name} changes {their} mind'),
        right: game.roomCode,
      }}
    >
      {/* The headline band, with the ledger dots pushed to its right-hand end -
          so the room can feel how far into the night it is without doing the
          arithmetic on "Round X of Y" itself. */}
      <HeadlineBand
        eyebrow={'Ledger ' + position.number + ' of ' + position.total + ' closed'}
        right={
          <LedgerDots
            total={position.total}
            filled={position.number}
            className="hidden desktop:flex"
          />
        }
      >
        <Title size="lg">Ledger filed.</Title>
        <p className="mt-2 font-body text-[14.5px] text-warm desktop:text-[16px]">
          {say(roundType.label)} is done. Here is how it went.
        </p>
      </HeadlineBand>

      {/* The two boards, side by side and separated by a rule rather than a
          gap - this round's points on the left, the running total on the
          right. On a phone they stack; either way, a long roster scrolls the
          whole page rather than growing its own private scrollbar. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-2">
        <Region edge="right" className="gap-3.5">
          <PanelHeading right="Points earned">This ledger</PanelHeading>
          <div>
            <Standings entries={board} meId={meId} isHost={isHost} showDelta badgeMoves={moves} />

            {/* The mercy card. Lives under this round's board because that is
                what it is a consequence of. */}
            {losers.length > 0 && (
              <div className="mt-5 border border-rule border-l-[5px] border-l-red bg-panel px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2
                    className="font-impact text-[18px] uppercase text-ivory desktop:text-[22px]"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    A favour for last place
                  </h2>
                  <span
                    className="font-mono text-[9.5px] font-bold uppercase text-dim desktop:text-[10px]"
                    style={{ letterSpacing: '0.18em' }}
                  >
                    Goes to {joinNames(losers.map((entry) => entry.displayName))}
                  </span>
                </div>

                {handouts.length > 0 ? (
                  <div
                    className="mt-3.5"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {handouts.map((entry) => (
                      <PowerCard key={entry.id} card={entry.card} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 font-body text-[13.5px] text-warm desktop:text-[15px]">
                    Their card is waiting for them in the next round.
                  </p>
                )}
              </div>
            )}
          </div>
        </Region>

        <Region className="justify-between gap-3.5">
          <div className="flex flex-col gap-3.5">
            <PanelHeading right="Running total">Overall so far</PanelHeading>
            <div>
              <Standings entries={overall} meId={meId} isHost={isHost} />
              {isHost && (
                <div className="mt-5">
                  <ScoreAdjuster game={game} onRemovePlayer={onRemovePlayer} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {isHost ? (
              <BigButton onClick={() => setTransition(lastOne ? 'finish' : 'next')}>
                {lastOne ? 'Close the case and show the standings' : 'Open the next ledger'}
              </BigButton>
            ) : (
              <p className="font-body text-[14.5px] text-warm desktop:text-[16px]">
                {lastOne ? 'That was the last ledger. Sit tight…' : 'Waiting on the next ledger…'}
              </p>
            )}
          </div>
        </Region>
      </div>
    </Screen>
  )
}
