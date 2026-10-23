// How the two landing-page boards - see `CaseBoard.jsx` - fit whatever window
// they are actually shown in. Pure logic, no JSX, so it lives on its own
// rather than inside `CaseBoard.jsx`: that file is components only, called
// only from `StartScreen.jsx`, which does the fitting once per render and
// hands the two boards the numbers rather than letting either recompute them.

import { useEffect, useState } from 'react'

// The desktop canvas. 1492x830 in the file, less its own 30px footer strip -
// the footer is real chrome here and is drawn by `Screen` at the window's true
// width, so it is not part of the scaled board. `BOARD_H` is exported: the
// board itself (`CaseBoard.jsx`) also needs it, to size the layer it draws on.
const BOARD_W = 1492
export const BOARD_H = 800

// Below this the desktop board is dropped for the phone one. Chosen from the
// scale it implies rather than from a round number: at 1180px the board scales
// to ~0.79, which still leaves the design's 9px Courier labels above 7px.
const COLLAGE_MIN_W = 1180
const COLLAGE_MIN_H = 600

// How much spare width may be pushed into the two gutters between clusters
// before the whole board simply centres instead. Past about a fifth of the
// board's width the clusters stop reading as one composition and start reading
// as three separate things, which is worse than a margin.
const SLACK_MAX = 450

// ---------------------------------------------------------------------------
// FITTING EACH BOARD TO THE WINDOW
// ---------------------------------------------------------------------------

function readViewport() {
  if (typeof document === 'undefined') return { w: 0, h: 0 }
  return {
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  }
}

// Deliberately measured off `documentElement` rather than off this screen's own
// container. The container's height depends on which board is chosen and the
// choice depends on the height, which is a loop; the window is the one thing
// that is true before anything is laid out.
export function useViewport() {
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    // Only ever sets new state when the numbers actually moved. The observer
    // below fires on attach and on any document resize, and handing React a
    // fresh object every time would re-render the whole board for nothing.
    const onResize = () =>
      setViewport((current) => {
        const next = readViewport()
        return next.w === current.w && next.h === current.h ? current : next
      })
    onResize()
    window.addEventListener('resize', onResize)

    // Belt and braces for the changes `resize` does not report: a scrollbar
    // appearing or disappearing elsewhere on the page moves
    // `documentElement.clientWidth` without a resize event ever firing.
    //
    // It is NOT what makes a devtools viewport override work - checked, and it
    // does not fire for one; only a reload picks that up. Real window resizing
    // is handled by the listener above, which was confirmed live.
    const observer = new ResizeObserver(onResize)
    observer.observe(document.documentElement)

    return () => {
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [])

  return viewport
}

// Returns null when the window is too small to draw the desktop board at a size
// worth reading, which is the signal to use the phone board instead.
export function fitBoard({ w, h }) {
  const availW = w
  const availH = h - 30 // the footer strip, which is chrome and never scales
  if (availW < COLLAGE_MIN_W || availH < COLLAGE_MIN_H) return null

  // Fill the height first - that is what stops the board ever needing to
  // scroll - then fall back to the width if the window is a narrow one.
  let scale = availH / BOARD_H
  if (BOARD_W * scale > availW) scale = availW / BOARD_W

  const designW = availW / scale
  const slack = Math.max(0, Math.min(SLACK_MAX, designW - BOARD_W))
  // Anything left over after the cap is a margin, split evenly.
  const padX = Math.max(0, (designW - BOARD_W - slack) / 2)
  const padY = Math.max(0, (availH / scale - BOARD_H) / 2)

  return {
    scale,
    layerW: BOARD_W + slack + padX * 2,
    padY,
    offsets: [padX, padX + slack / 2, padX + slack],
  }
}
