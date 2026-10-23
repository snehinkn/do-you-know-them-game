import { useState } from 'react'
import { Button, TextLink } from '../ui.jsx'

// ---------------------------------------------------------------------------
// DELETE THIS GAME - host only. Added 29 August: once anyone besides Snehin
// might run their own game, a game that can never be removed except by hand
// in the database stops being acceptable (NEW-APP-PLAN.md §8).
//
// Wired in at the two natural bookends of a game's life: the setup sheet, for
// a case opened by mistake and abandoned before it is ever played, and the
// closing leaderboard, for cleaning up after a night that is actually over.
// Both share this one component rather than two copies of the same ask-twice
// control.
//
// `--red-dried` (this app's `deep-red`) is the design's own token for a
// destructive-action outline - the one place besides an error banner that red
// is allowed to mean something other than "look here, this is live". Quiet
// until pressed, on purpose: this is not a control anyone should find by
// accident.
// ---------------------------------------------------------------------------
export default function DeleteGameControl({ onDelete, tone = 'room', className = '' }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const dim = tone === 'paper' ? 'text-red-deep/70 hover:text-red-deep' : 'text-dim hover:text-red'

  if (!confirming) {
    return (
      <div className={'text-center ' + className}>
        <TextLink onClick={() => setConfirming(true)} className={dim}>
          Delete this game
        </TextLink>
      </div>
    )
  }

  return (
    <div className={'border border-red-deep px-4 py-3.5 text-center ' + className}>
      <p className="font-mono text-[11px] text-red-deep uppercase" style={{ letterSpacing: '0.14em' }}>
        This cannot be undone
      </p>
      <p className="mt-2 text-[13.5px] leading-[1.5] text-dim">
        Every player, answer and score in this game is gone for good - not switched off, deleted.
      </p>
      <div className="mt-3.5 flex flex-col gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            setBusy(true)
            await onDelete()
            setBusy(false)
          }}
          disabled={busy}
          className="!border-red-deep !text-red-deep"
        >
          {busy ? 'Deleting…' : 'Yes, delete it'}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
          Never mind
        </Button>
      </div>
    </div>
  )
}
