// ---------------------------------------------------------------------------
// ONE LEADERBOARD'S ROWS - the shape every ranked list in the room shares:
// rank, name, a figure on the right. Used on the reveal ("where everyone
// stands now"), the round-results screen (twice - this round's board and the
// overall one), and the wager standings shown before betting blind.
//
// Three of those were previously three separate, drifting bits of markup, one
// of them still in the pre-redesign look. Pulled into one component so a
// change to how a standings row looks only ever has to be made once, and so
// the three screens cannot quietly disagree with each other about it again.
//
// `showDelta` prints the figure as a signed swing ("+3") rather than a running
// total - the round-results screen's own board needs both, side by side.
//
// `badgeMoves`, keyed by player id (see `badge.js`'s `badgeMovesForRound`),
// prints the design's own "UP ONE" / "DOWN ONE" suffix under a name whose
// rank actually moved this round. A held badge - the common case - prints
// nothing extra, which is what keeps a genuine move worth noticing.
// ---------------------------------------------------------------------------

export default function Standings({ entries, meId, isHost, showDelta = false, badgeMoves = null }) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const isMe = entry.id === meId && !isHost
        const move = badgeMoves ? badgeMoves[entry.id] : null
        const moved = move && move.direction !== 'held'
        return (
          <li
            key={entry.id}
            className={
              'flex min-h-[48px] items-center gap-3 border px-3.5 py-2.5 ' +
              (isMe ? 'border-red bg-board-warm' : 'border-line bg-panel')
            }
          >
            <span className="w-[24px] shrink-0 font-mono text-[15px] text-dim tabular-nums">
              {entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] text-ivory">
              {entry.displayName}
              {isMe && (
                <span
                  className="mt-0.5 block font-mono text-[10px] text-red uppercase"
                  style={{ letterSpacing: '0.12em' }}
                >
                  That&apos;s you
                </span>
              )}
              {moved && (
                <span
                  className="mt-0.5 block font-mono text-[10px] uppercase"
                  style={{ letterSpacing: '0.12em', color: move.direction === 'up' ? 'var(--color-red)' : 'var(--color-dim)' }}
                >
                  {move.badge.name} · {move.suffix}
                </span>
              )}
            </span>
            <span
              className={
                'shrink-0 font-mono text-[18px] tabular-nums ' +
                (showDelta ? 'text-red' : 'text-ivory')
              }
            >
              {showDelta ? (entry.score >= 0 ? '+' + entry.score : entry.score) : entry.score}
            </span>
          </li>
        )
      })}
      {entries.length === 0 && (
        <li className="py-3 text-center text-[14px] text-dim">Nobody on the sheet yet.</li>
      )}
    </ul>
  )
}
