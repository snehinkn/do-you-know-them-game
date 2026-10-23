import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// COUNTING DOWN FROM A SHARED TIMESTAMP
//
// `endsAt` is an ISO string (or null) read straight off the game row -
// `games.timer_ends_at`. Every phone in the room renders its own countdown
// from that SAME instant, rather than from a duration handed to each device
// separately, which is what keeps nine phones from drifting apart on how much
// time is left (the design's own rule - see the README's "Timers must be
// server-authoritative" note).
//
// Returns whole seconds remaining, floored at 0, and `null` when there is no
// timer running at all - which is different from 0 seconds left, and callers
// that only care about "is a timer live right now" should check for null
// rather than for a falsy number.
// ---------------------------------------------------------------------------
export function useCountdown(endsAt) {
  const target = endsAt ? new Date(endsAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!target) return
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [target])

  if (!target) return { secondsLeft: null, expired: false }

  const secondsLeft = Math.max(0, Math.ceil((target - now) / 1000))
  return { secondsLeft, expired: secondsLeft <= 0 }
}

// `mm:ss`, the one format every timer in the design is shown in.
export function formatCountdown(secondsLeft) {
  if (secondsLeft === null || secondsLeft === undefined) return '--:--'
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  return String(m) + ':' + String(s).padStart(2, '0')
}
