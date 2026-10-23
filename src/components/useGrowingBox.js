import { useCallback, useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// A TEXT BOX THAT GROWS WITH WHAT IS TYPED IN IT.
//
// Both places where somebody writes something - the answer box and the caption
// box - used to be a fixed two or three lines. On a phone that meant a longer
// answer scrolled up out of sight inside the box while it was still being
// written: you could not read back your own first sentence without dragging
// about inside a small window. Sell It allows 200 characters and a caption 120,
// which are eight and five lines on a 375px screen, so this was the normal case
// rather than an edge one. Reported after the 18 August test run.
//
// Returns a ref to put on the <textarea>. The minimum height stays with the
// textarea itself as a class, so an empty box still looks like somewhere to
// write a sentence rather than a one-line slot.
//
// Height is cleared before it is measured, because scrollHeight only reports
// the height of the CONTENT when the element is not already being held taller
// than its content - without that reset the box could grow but never shrink
// again when text was deleted.
//
// The borders have to be added back on. These boxes are border-box, so a height
// set on one has to cover the 3px border top and bottom as well as the text;
// scrollHeight counts the padding but not the border, so handing it straight to
// height leaves the box 6px short and clips the bottom of the last line.
// Measured doing exactly that - a 199-character pitch asked for 211px and got a
// 205px content area.
//
// Also re-measures on a width change to the box itself, not just on typing -
// rotating a phone or resizing a browser window rewraps already-typed text
// into a different number of lines, and the old height would otherwise stick
// until the next keystroke.
// ---------------------------------------------------------------------------
export function useGrowingBox(value) {
  const ref = useRef(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    const style = window.getComputedStyle(el)
    const borders =
      style.boxSizing === 'border-box'
        ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        : 0
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + borders + 'px'
  }, [])

  useEffect(() => {
    resize()
  }, [value, resize])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastWidth = el.offsetWidth
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return
      lastWidth = el.offsetWidth
      resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [resize])

  return ref
}
