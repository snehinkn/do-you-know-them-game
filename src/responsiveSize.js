// ---------------------------------------------------------------------------
// THE DESKTOP SCALE - two small helpers, kept in their own file rather than
// inside ui.jsx, on purpose: ui.jsx already has one file that mixes
// component and non-component exports (see its own note, and
// subjectContext.js's), and this project's own rule is not to add a second
// (`react-hooks(rules-of-hooks)` and fast-refresh both dislike it). Both
// helpers pair with the CSS in index.css's 860px block - `--breakpoint-desktop`
// in the `@theme`, so `desktop:` matches the same width these do.
//
// See `HANDOFF-10.md` §4 (Title's ceiling) and `HANDOFF-11.md` (everything
// else) for why these exist: widening the frame did nothing for a label,
// figure or caption whose size was a plain px number tuned for a 412px
// phone - two of those side by side just read as two phones, not a laptop.
// ---------------------------------------------------------------------------

// `Title`'s own trick: scale the two PX bounds of a `clamp(min, pref, max)`
// string by `factor`, leaving the `cqw` preference in the middle alone since
// it already grows with a wider container on its own. Does not touch
// `typeFit.js`'s tested bands - this only ever runs on the string they
// produce, at render time.
export function scaleClampPx(clampString, factor) {
  return clampString.replace(/(-?\d+(?:\.\d+)?)px/g, (_, num) => Math.round(Number(num) * factor) + 'px')
}

// The generic version, for anything whose size comes in as a plain px
// number rather than a clamp() - `Eyebrow`, `Figure`, `LedgerRow`,
// `FooterCaption` and so on. Returns the two CSS custom properties
// `.rs-text` (index.css) switches between; pair with the `rs-text` class.
//
// `factor` defaults to 1.3 - visibly bigger without dominating a label that
// is meant to stay quiet. Pass a larger one for something allowed to be a
// genuine desktop-sized figure.
export function rs(px, factor = 1.3) {
  return { '--rs-mobile': px + 'px', '--rs-desktop': Math.round(px * factor) + 'px' }
}
