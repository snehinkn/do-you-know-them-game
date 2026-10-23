// ---------------------------------------------------------------------------
// RANK INPUT - put a list of things in order. THE LINE-UP's own control.
//
// Deliberately uses up/down buttons rather than drag-and-drop. Dragging is
// fiddly on a phone, behaves differently across browsers, and is exactly the
// kind of thing that goes wrong in front of a room with nobody able to fix it.
// Buttons are boring, work identically everywhere, and are just as fast.
//
// The arrows are 46px square and must not shrink. Reordering is the ONLY thing
// this round asks anyone to do, and it is being done with a thumb.
//
// Restyled to the room language - was still the pre-redesign look (rounded
// corners, hard drop shadows, the old accent). No behaviour changed.
// ---------------------------------------------------------------------------

export default function RankInput({ items, onChange, disabled = false }) {
  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const next = [...items]
    const temp = next[index]
    next[index] = next[target]
    next[target] = temp
    onChange(next)
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li
          key={item}
          // Tighter on a laptop. 46px arrows plus py-3 make a 72px row, which is
          // a correct PHONE hit target and far too much furniture for a mouse:
          // five of them ate the column the question shares, and the question
          // came out clipped. Mobile keeps every pixel of its 44px minimum.
          className="flex min-h-[56px] items-center gap-3 border border-line bg-panel px-3.5 py-3
                     desktop:min-h-[52px] desktop:py-2"
        >
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center border border-red font-mono text-[15px] text-red">
            {index + 1}
          </span>

          <span className="min-w-0 flex-1 text-[16px] text-ivory">{item}</span>

          <span className="flex shrink-0 items-center gap-1.5">
            <MoveButton
              label={'Move ' + item + ' up'}
              onClick={() => move(index, -1)}
              disabled={disabled || index === 0}
              path="M5 15 L12 8 L19 15"
            />
            <MoveButton
              label={'Move ' + item + ' down'}
              onClick={() => move(index, 1)}
              disabled={disabled || index === items.length - 1}
              path="M5 9 L12 16 L19 9"
            />
          </span>
        </li>
      ))}
    </ol>
  )
}

function MoveButton({ onClick, label, disabled, path }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring grid h-[46px] w-[46px] place-items-center border border-line
                 text-ivory disabled:cursor-not-allowed disabled:opacity-25
                 desktop:h-[36px] desktop:w-[36px]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    </button>
  )
}
