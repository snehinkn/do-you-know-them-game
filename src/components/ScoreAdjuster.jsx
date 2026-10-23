import { useState } from 'react'
import { Plate, Button, TextLink } from '../ui.jsx'
import { rankedPlayers } from '../gameHelpers.js'

// ---------------------------------------------------------------------------
// DROP A PLAYER - host only.
//
// For someone who has gone quiet - closed the laptop, lost signal, wandered
// off - so the game stops waiting on an answer that is never coming.
//
// This used to also carry a free-form +/- score fixer. It was removed
// deliberately: it was the only way in the whole app to hand out an arbitrary
// number of points, which meant three power-up cards (Wildcard, Bonus
// Question, Vote of Confidence) could only be delivered by misusing it. Those
// cards now have their own fixed-choice payout buttons on the reveal screen
// (`CardPayouts.jsx`) instead of a control that could give anyone anything.
//
// Restyled to the room language.
// ---------------------------------------------------------------------------

export default function ScoreAdjuster({ game, onRemovePlayer }) {
  const [isOpen, setIsOpen] = useState(false)
  const [removing, setRemoving] = useState(null)

  if (!isOpen) {
    return (
      <div className="text-center">
        <TextLink onClick={() => setIsOpen(true)}>Drop a player</TextLink>
      </div>
    )
  }

  return (
    <Plate className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-impact text-[18px] text-ivory uppercase">Drop a detective</p>
        <Button variant="secondary" onClick={() => { setIsOpen(false); setRemoving(null) }}>
          Done
        </Button>
      </div>
      <p className="mb-4 text-sm text-dim">
        For someone who has gone quiet. Their score is kept, and they can rejoin with the same
        name.
      </p>

      <ul className="flex flex-col gap-2">
        {rankedPlayers(game).map((player) => (
          <li key={player.id} className="border border-line bg-panel px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ivory">
                {player.displayName}
              </span>

              <span className="w-10 shrink-0 text-center font-mono text-[17px] text-ivory tabular-nums">
                {player.score}
              </span>

              {onRemovePlayer && (
                <button
                  type="button"
                  aria-label={'Remove ' + player.displayName + ' from the game'}
                  onClick={() => setRemoving(removing === player.id ? null : player.id)}
                  className="focus-ring min-h-[44px] shrink-0 border border-line px-3 font-mono text-xs
                             text-ivory uppercase"
                  style={{ letterSpacing: '0.1em' }}
                >
                  Drop
                </button>
              )}
            </div>

            {/* Asks twice, because removing the wrong person mid-game would be
                a genuinely annoying thing to undo in front of everyone. */}
            {removing === player.id && (
              <div className="mt-3 border border-red bg-board-warm p-3">
                <p className="text-sm font-semibold text-ivory">
                  Drop {player.displayName} from the game?
                </p>
                <p className="mt-1 text-[13px] text-dim">
                  They stop counting towards answers and leaderboards. Their score is kept, and
                  they can rejoin with the same name.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => setRemoving(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      onRemovePlayer(player.id)
                      setRemoving(null)
                    }}
                  >
                    Drop them
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Plate>
  )
}
