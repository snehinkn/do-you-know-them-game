import { useSay } from '../subjectContext.js'
import { ledgerNumeral } from '../roundIdentity.js'
import { formatCountdown } from '../useCountdown.js'
import { LedgerBand } from '../ui.jsx'

// ---------------------------------------------------------------------------
// The ledger header band: a full-bleed red bar carrying the ledger numeral, the
// round's name, and where we are inside it. Anyone can tell which round they
// are in before reading a word of the question.
//
// Shared by the question screen and the results screen that follows it, so a
// question and its result are visibly the same thing. Lives in components/
// rather than ui.jsx because it reaches into the round identities - the design
// system does not import game data. The bar itself is `LedgerBand` in ui.jsx;
// this file only decides what goes in it.
//
// IT IS CHROME, NOT CONTENT. Pass it to `Screen`'s own `band` slot rather than
// rendering it inside a screen's content region - it is full bleed, it sits
// directly under the status strip, and a screen that renders it inline has to
// cancel its own gutter with a negative margin to get there. That negative
// margin was how the old build did it and it broke every time a screen's
// padding changed.
//
// `position` is optional. The wager round shows this band before anyone has
// seen which question they are betting on, and a counter there would be a
// number nobody can act on.
//
// TWO THINGS THE OLD BAND CARRIED THAT THIS ONE DOES NOT:
//
// The drawn mark and the patron ("Thoth, Scribe"). Both survive - the mark is
// on the setup bill, and the patron still names each round - but this band had
// four things competing inside it. The round's NAME is the thing a player needs
// at a glance mid-game; the patron is flavour and reads better where there is
// room for it.
// ---------------------------------------------------------------------------

export default function RoundBand({ roundType, position, ledger, label = 'Q', right, secondsLeft }) {
  const say = useSay()

  // A live timer takes over the right-hand slot entirely rather than sitting
  // beside the question count - two Courier numbers fighting for the same
  // strip of height reads as clutter, and the countdown is the one a player
  // actually needs mid-question.
  const showTimer = secondsLeft !== null && secondsLeft !== undefined

  let rightSlot = right
  if (showTimer) {
    rightSlot = formatCountdown(secondsLeft)
  } else if (rightSlot === undefined && position) {
    rightSlot = label + position.number + ' / ' + position.total
  }

  const title =
    (ledger !== undefined && ledger !== null ? 'Ledger ' + ledgerNumeral(ledger) + ' · ' : '') +
    say(roundType.label)

  return <LedgerBand title={title} right={rightSlot} />
}
