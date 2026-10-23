import { Screen, Plate, OneLiner, Mark, Eyebrow, Clock, PlayerTag, SweepRing } from '../ui.jsx'
import { answerFor, currentQuestion, badgeNumberFor } from '../gameHelpers.js'
import { currentBadgeFor } from '../badge.js'
import { scaleClampPx } from '../responsiveSize.js'

// ---------------------------------------------------------------------------
// WAITING - 3H in the design bundle. A plain "hang on a moment" screen, used
// whenever a player has nothing to do but wait. It always says WHY they are
// waiting, so nobody sits there deciding the app has frozen and reloading it
// in the middle of a round.
//
// Covers the design's "filed" state (you did your part - see the sweep ring
// standing in for the room still working) as much as "missed" (you never got
// the chance, or were dropped) - the caller's `title`/`message` carry the real
// difference, this shell just carries the chrome consistently underneath
// whichever one it is.
//
// The mark is a drawn path rather than a picture, like everywhere else. Marks
// for the two places this screen is used live in MARKS below, so a caller
// names one instead of pasting SVG into the router.
//
// Restyled to the room language.
// ---------------------------------------------------------------------------

export const MARKS = {
  // An hourglass, for waiting on the game to start.
  hourglass: 'M7 3 L17 3 M7 21 L17 21 M8 3 L8 8 L12 12 L16 8 L16 3 M8 21 L8 16 L12 12 L16 16 L16 21',
  // A balance, for waiting on a verdict.
  scales: 'M12 5 L12 20 M7 20 L17 20 M5 9 L19 9 M5 9 L3 13 L7 13 Z M19 9 L17 13 L21 13 Z',
}

export default function WaitingScreen({ mark, title, message, oneLiner, game, meId, roomCode }) {
  // If we know what they submitted, show it back so they can see it landed.
  let submitted = null
  if (game && meId) {
    const question = currentQuestion(game)
    const myAnswer = answerFor(game, game.currentQuestionId, meId)
    if (myAnswer && question) submitted = myAnswer
  }

  const showBadge = Boolean(game && meId)
  const badge = showBadge ? currentBadgeFor(game, meId) : null
  const badgeNo = showBadge ? badgeNumberFor(game, meId) : null

  return (
    <Screen
      fixed
      scroll
      // Centred down the frame as well as across it. This screen is one mark,
      // one headline and a line of copy - on a phone that fills 844px and looks
      // deliberate, but pinned to the top of an 830px laptop window it left
      // more than half the screen bare and read as a page that had failed to
      // finish loading. There is nothing to add to a waiting screen, so the fix
      // is to let it own the middle rather than the top.
      centerY
      status={
        showBadge
          ? { left: <Clock />, right: <PlayerTag badgeNo={badgeNo} badge={badge} /> }
          : { left: 'Standing by', right: roomCode ? 'Case ' + roomCode : null }
      }
      footer={{ left: 'Nothing to do but wait', right: roomCode }}
    >
      <div className="text-center desktop:mt-0">
        <div className="mx-auto mb-4 flex justify-center">
          {mark ? <Mark path={mark} size={30} /> : <SweepRing size={44} speed="sm" />}
        </div>
        {/* Same trap as `FinalLeaderboard`'s headline and toast box: the
            `desktop:text-[56px]` here was dead on arrival, beaten by the
            inline `fontSize` on the same element regardless of viewport.
            Moved onto `title-fit` so the desktop value actually lands. */}
        <h1
          className="font-impact title-fit leading-[1.04] text-ivory uppercase"
          style={{
            '--title-size': 'clamp(24px, 6cqw, 42px)',
            '--title-size-desktop': scaleClampPx('clamp(24px, 6cqw, 42px)', 1.4),
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </h1>
        <p className="mt-2.5 text-[15px] text-dim desktop:text-[17px]">{message}</p>
      </div>

      {submitted && (
        <Plate hero className="mt-6 px-[18px] py-5">
          <Eyebrow className="text-dim" size={10} tracking="0.16em">
            You said
          </Eyebrow>

          <div className="mt-2.5">
            {submitted.order && submitted.order.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {submitted.order.map((item, index) => (
                  <li
                    key={item}
                    className="flex min-h-[46px] items-center gap-3 border border-line bg-panel px-3.5 py-2.5"
                  >
                    <span className="grid h-[28px] w-[28px] shrink-0 place-items-center border border-red font-mono text-[13px] text-red">
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-[15px] text-ivory">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              // Courier, not the body face - the design's own rule for
              // anything a player typed: it reads back as typewritten
              // evidence, same as everywhere else this session applied it.
              <p className="border border-line bg-panel px-3.5 py-3 font-mono text-[16px] text-ivory">
                {submitted.text || 'You did not answer this one.'}
              </p>
            )}
          </div>
        </Plate>
      )}

      {oneLiner && (
        <div className="mt-6 flex justify-center">
          <OneLiner>{oneLiner}</OneLiner>
        </div>
      )}
    </Screen>
  )
}
