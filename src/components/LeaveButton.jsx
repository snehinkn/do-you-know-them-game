import { useState } from 'react'
import { Button, Eyebrow, Impact } from '../ui.jsx'

// ---------------------------------------------------------------------------
// GETTING OUT - player only. Two different exits, for two different problems.
//
//   LEAVE THE GAME   You are here, you are done. Everyone carries on without
//                    you and the host stops waiting on your answers. Your score
//                    is kept and you can come back.
//
//   SWITCH ROOM      You are in the WRONG game. This browser remembers the last
//                    room you joined, so if that game was scrapped and a new one
//                    started, you would otherwise be stuck looking at a dead
//                    room with no way back to the join screen. This forgets the
//                    room entirely and hands you a fresh code box.
//
// Both ask twice. Both are easy to hit by accident on a phone.
//
// WHY THIS IS PINNED RATHER THAN STACKED UNDER THE SCREEN
//
// It used to render in the normal flow, directly beneath whatever screen the
// player was on. That was fine when screens could scroll. Under the redesign
// every in-game screen is a fixed 412 x 812 frame that must not scroll, and a
// block sitting underneath one guaranteed that EVERY player screen scrolled -
// by exactly the height of these two links.
//
// So it comes out of the flow entirely: a small pinned control in the corner,
// and a full overlay when it is actually asking. Nothing about a screen's
// layout has to know it exists, which is also why no screen has to remember to
// leave room for it.
//
// The trigger is deliberately quiet and deliberately still 44px of tap target.
// It is the one control on the screen nobody should hit by accident.
// ---------------------------------------------------------------------------

export default function LeaveButton({ onLeave, onSwitchRoom }) {
  const [confirming, setConfirming] = useState(null)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming('leave')}
        aria-label="Leave the game, or switch room"
        className="focus-ring fixed right-3 bottom-2 z-20 grid h-[44px] w-[44px] place-items-center
                   text-dim/70 hover:text-ivory"
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* A door with an arrow going out of it. */}
          <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />
        </svg>
      </button>
    )
  }

  const isLeaving = confirming === 'leave'

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-page/85 px-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[364px] border-2 border-line bg-board p-5">
        <Eyebrow className="text-red" size={10} tracking="0.18em">
          On your own head
        </Eyebrow>

        <Impact size={24} className="mt-2.5 text-ivory">
          {isLeaving ? 'Leave the case?' : 'Wrong room?'}
        </Impact>

        <p className="mt-3 text-[13.5px] leading-[1.55] text-dim">
          {isLeaving
            ? 'Everyone else carries on without you, and the host stops waiting for your answers. Your score so far is kept, so you can come back on this device if you change your mind.'
            : 'This forgets the room on this device and takes you back to the code box. Use it if you are stuck looking at an old game. Your place in this one is kept in case you come back.'}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={isLeaving ? onLeave : onSwitchRoom}>
            {isLeaving ? 'Yes, leave' : 'Take me to the code box'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(isLeaving ? 'switch' : 'leave')}>
            {isLeaving ? 'Actually, wrong room' : 'Actually, leave the case'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Never mind
          </Button>
        </div>
      </div>
    </div>
  )
}
