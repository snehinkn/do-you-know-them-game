import { OneLiner, TextLink, Region, Eyebrow, PanelHeading } from '../ui.jsx'
import { scaleClampPx } from '../responsiveSize.js'
import { rankedPlayers, activeCategories } from '../gameHelpers.js'
import { badgesAfterRound, badgeAt } from '../badge.js'
import { WINNER_LINES, LOSER_LINES, pickFrom } from '../copy.js'
import DeleteGameControl from '../components/DeleteGameControl.jsx'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// CASE CLOSED - the final scores. 2D in the design bundle.
//
// The emotional payoff and the screen people will screenshot, so it gets the
// most decoration: the halftone behind everything, and the winner's row at
// nearly double the size of everyone else's.
//
// The winner line and the last-place line are drawn from the copy pools, seeded
// by the game id. Seeded rather than random because this screen re-renders every
// time anything in the game changes, and a joke that rewrites itself while eight
// people are reading it looks broken. The last-place line is affectionate on
// purpose - somebody has to come last at their friend's party, and the joke
// is on the situation rather than on them.
//
// Restyled to the room language, replacing the old marketing-poster look
// (shiraz, rays, a drawn cup) with the same red-and-Archivo-Black case-file
// language as the rest of the night. Also where every player's FINAL badge
// gets shown - `currentBadgeFor` deliberately holds a badge still mid-round,
// which is the wrong read once the whole night is actually over, so this
// works out the badge timeline all the way to the last round played instead.
// ---------------------------------------------------------------------------

// "Ana", "Ana and Bo", "Ana, Bo and Cal" - reads like a person wrote it.
function joinNames(names) {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return names[0] + ' and ' + names[1]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

export default function FinalLeaderboard({ game, isHost, meId, onPlayAgain, onDeleteGame }) {
  const say = useSay()
  const ranked = rankedPlayers(game)

  // The badge every player actually finished the night wearing - the whole
  // timeline played out to its last round, not held mid-round the way the
  // in-game status bar deliberately holds it.
  const finalBadges = badgesAfterRound(game, activeCategories(game).length - 1)

  // Everyone sharing rank 1 is a winner, because ties are possible.
  const winners = ranked.filter((player) => player.rank === 1)
  const tied = winners.length > 1

  // Only call somebody last when there genuinely is a last: not with one player,
  // and not when the whole room finished level.
  //
  // Ties matter here as much as they do at the top. Two people on the same
  // lowest score are equally last, and naming one of them - whichever happened
  // to sort last - singles somebody out at their friend's party for no
  // reason. When it is shared, everybody sharing it is named, and the pooled
  // joke is dropped rather than bent into a sentence it was not written for.
  const bottomRank = ranked.length > 1 ? ranked[ranked.length - 1].rank : null
  const lastPlacers = bottomRank === null ? [] : ranked.filter((p) => p.rank === bottomRank)
  const hasRealLastPlace = lastPlacers.length > 0 && bottomRank !== 1
  const lastIsShared = lastPlacers.length > 1

  const winLine = say(pickFrom(WINNER_LINES, game.id))
  const loseLine = say(pickFrom(LOSER_LINES, game.id + 'last'))
  const toast = say('Here is to {name}')

  return (
    // The one screen in the app that carries no chrome at all - no status
    // strip, no ledger band, no footer. It is the end of the night, and the
    // bundle draws it as two full-height regions and nothing else.
    <div className="board-ground relative flex h-screen w-full flex-col overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto desktop:grid desktop:grid-cols-[1fr_560px]">
        <Region className="justify-between gap-8 desktop:py-11">
          <div className="flex flex-col gap-3.5">
            <Eyebrow className="text-red" size={11} tracking="0.28em">
              Case closed
            </Eyebrow>

            {/* The one headline in the whole app that only fires once a night,
                so it gets more room than the in-game `Title` ceiling gives
                anything else. Reuses `Title`'s own `.title-fit` mechanism: a
                plain `desktop:text-[Npx]` class here would lose to the inline
                `fontSize` this element needs for its `cqw` fluid sizing -
                inline style always beats a class, media query or not. */}
            <h1
              className="title-fit font-impact uppercase"
              style={{
                '--title-size': 'clamp(34px, 9cqw, 62px)',
                '--title-size-desktop': scaleClampPx('clamp(34px, 9cqw, 62px)', 1.75),
                lineHeight: 0.86,
                letterSpacing: '-0.05em',
              }}
            >
              {tied ? (
                <>
                  <span className="text-red">It is a tie</span>
                </>
              ) : (
                <>
                  <span className="block text-red">
                    {winners[0] ? winners[0].displayName : 'Nobody'}
                  </span>
                  <span className="block text-ivory">{say('knows {them} best')}</span>
                </>
              )}
            </h1>

            <p className="font-body text-[15px] text-warm desktop:max-w-[52ch] desktop:text-[17px]">
              {tied
                ? winners.map((player) => player.displayName).join(' and ') + ' share the file.'
                : winLine}
            </p>

            {hasRealLastPlace && (
              <p className="font-body text-[14.5px] leading-[1.55] text-warm desktop:max-w-[52ch] desktop:text-[16px]">
                <span className="font-semibold text-ivory">
                  {joinNames(lastPlacers.map((player) => player.displayName))}
                </span>{' '}
                {lastIsShared ? 'share last place. Nobody is admitting to it.' : loseLine}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-5 desktop:pb-6">
            {/* The toast. The design draws this as a big outlined control, but
                it is not one - there is nothing to press. So it keeps the
                outline and the size and stays a panel, rather than inventing an
                action to justify a button shape. */}
            <div className="border-2 border-red px-5 py-5 desktop:max-w-[460px] desktop:px-6 desktop:py-6">
              <p
                className="title-fit font-impact uppercase text-ivory"
                style={{
                  '--title-size': 'clamp(19px, 5cqw, 26px)',
                  '--title-size-desktop': scaleClampPx('clamp(19px, 5cqw, 26px)', 1.4),
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                }}
              >
                {toast}
              </p>
            </div>

            <OneLiner>{say('The precinct is closed · {They} {is} going to bed')}</OneLiner>

            {isHost && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-7">
                  <TextLink onClick={onPlayAgain}>Open a new case</TextLink>
                </div>
                {onDeleteGame && (
                  <DeleteGameControl onDelete={onDeleteGame} className="w-full max-w-[380px]" />
                )}
              </div>
            )}
          </div>
        </Region>

        <Region edge="left" className="gap-3 desktop:py-11">
          <PanelHeading right="Points">Final standings</PanelHeading>
          <ol className="flex flex-col gap-2.5 desktop:gap-3">
            {ranked.map((player) => (
              <FinalRow
                key={player.id}
                player={player}
                badge={badgeAt(finalBadges[player.id] ?? 0)}
                isWinner={player.rank === 1}
                isMe={player.id === meId && !isHost}
              />
            ))}
          </ol>
          <p
            className="shrink-0 font-mono text-[9.5px] leading-[1.9] uppercase text-dim desktop:text-[10px]"
            style={{ letterSpacing: '0.18em' }}
          >
            Case {game.roomCode} · closed
          </p>
        </Region>
      </div>
    </div>
  )
}

// One row of the final board. The winner is loud and everyone else steps down
// to a single quieter treatment - inventing a three-tier podium distinction
// between second and third is a thing eight friends will not care about.
function FinalRow({ player, badge, isWinner, isMe }) {
  return (
    <li
      className="flex items-center gap-3 border text-left desktop:gap-4"
      style={{
        borderColor: isWinner ? 'var(--color-red)' : 'var(--color-line)',
        backgroundColor: isWinner ? 'var(--color-red)' : 'var(--color-panel)',
        color: isWinner ? 'var(--color-bone)' : 'var(--color-ivory)',
        padding: isWinner ? '18px 16px' : '12px 16px',
      }}
    >
      <span
        className="grid h-[36px] w-[36px] shrink-0 place-items-center border font-mono text-[16px] tabular-nums desktop:h-[46px] desktop:w-[46px] desktop:text-[20px]"
        style={{
          borderColor: isWinner ? 'var(--color-bone)' : 'var(--color-line)',
          backgroundColor: isWinner ? 'var(--color-bone)' : 'var(--color-board-warm)',
          color: isWinner ? 'var(--color-red)' : 'var(--color-ivory)',
        }}
      >
        {player.rank}
      </span>

      <span className="min-w-0 flex-1">
        {/* Font-size has to be a class, not the inline style this used to
            be - an inline `fontSize` beats ANY class on the same element,
            `desktop:` media query or not, so the desktop bump was silently
            losing to it until this was measured directly rather than
            eyeballed. */}
        <span
          className={
            'block truncate font-impact uppercase ' +
            (isWinner ? 'text-[26px] desktop:text-[38px]' : 'text-[18px] desktop:text-[25px]')
          }
          style={{ letterSpacing: '-0.02em' }}
        >
          {player.displayName}
        </span>
        <span
          className="mt-0.5 block font-mono text-[10px] uppercase desktop:text-[12px]"
          style={{ letterSpacing: '0.14em', opacity: 0.75 }}
        >
          {badge.name}
          {isMe && ' · that is you'}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={
            'block font-mono leading-none tabular-nums ' +
            (isWinner ? 'text-[28px] desktop:text-[40px]' : 'text-[19px] desktop:text-[26px]')
          }
        >
          {player.score}
        </span>
        <span
          className="mt-0.5 block font-mono text-[9.5px] uppercase desktop:text-[11px]"
          style={{ letterSpacing: '0.14em', opacity: 0.7 }}
        >
          Points
        </span>
      </span>
    </li>
  )
}
