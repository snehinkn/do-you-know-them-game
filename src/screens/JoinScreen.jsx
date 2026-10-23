import { useState } from 'react'
import {
  Screen,
  Region,
  HeadlineBand,
  Card,
  Button,
  TextField,
  ErrorBanner,
  Title,
  Eyebrow,
  FooterCaption,
} from '../ui.jsx'
import { BADGES } from '../badge.js'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// 3A - REPORTING IN. Join, for somebody who is already in the right room.
//
// The poster on StartScreen is for arriving from nowhere. This is the shorter
// version: the room is known, the case number is on screen, and the only thing
// left is a name. Kept separate rather than folded into the poster because a
// guest who has already typed the code should not be asked for it twice.
//
// Rebuilt against bundle 2's own "Join" frame (HANDOFF-9) - the headline, the
// "what you are signing" card, the second paragraph and the button label all
// come from there. Wired to the guest of honour's real name rather than the
// canvas's placeholder "Hiya".
//
// TWO DEPARTURES FROM THE DESIGN, BOTH DELIBERATE AND STILL STANDING:
//
// 1. The design draws the case number as an editable field, because in the
//    prototype this screen is where you type it. Here it is already known -
//    that is the whole reason this screen exists rather than the poster - so
//    it is shown in the same red box, read-only. The two-box rhythm the
//    design wants is kept; the lie that you have to type it is not.
//
// 2. The design's footer says "SIX DETECTIVES MAX". This app has never had a
//    player cap and does not enforce one, and a rule printed on screen that
//    nothing behind it enforces is worse than no rule at all. The line stays
//    rewritten to something that IS true, keeping the joke bundle 2's own
//    footer reaches for ("one of them embarrasses themselves") rather than
//    the cap it hangs it on.
// ---------------------------------------------------------------------------

export default function JoinScreen({ expectedRoomCode, existingNames, busy, onJoin }) {
  const say = useSay()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function handleJoin() {
    const cleanName = name.trim()

    if (cleanName === '') {
      setError('Please type your name so everyone knows who you are.')
      return
    }
    // Two people called "Dev" would make judging confusing, so names must differ.
    // The database enforces this too; checking here just gives a faster answer.
    const nameIsTaken = existingNames.some(
      (existing) => existing.toLowerCase() === cleanName.toLowerCase(),
    )
    if (nameIsTaken) {
      setError('Somebody already joined with that name. Try adding your last initial.')
      return
    }

    setError('')
    onJoin(cleanName)
  }

  return (
    <Screen
      fixed
      pad={false}
      status={{ left: 'Reporting for duty', right: 'Not sworn in' }}
      footer={{ left: 'No account · no app · no mercy', right: 'Case ' + expectedRoomCode }}
    >
      <HeadlineBand>
        <Title size="lg">Take the case.</Title>
      </HeadlineBand>

      {/* No canvas frame exists for this screen - no bundle ever redrew it
          wide. So it follows the house pattern rather than inventing one: two
          REGIONS with a 2px rule between them, not two blocks with a gap. The
          difference matters here more than anywhere, because this screen is
          short - sign-in is two fields and a button - and a short block sitting
          in the top third of an 830px window with bare ground under it reads as
          a page that failed to load. Regions run the full height and centre
          their own content, so the space belongs to a column instead. */}
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[1fr_420px]">
        <Region className="justify-center gap-5">
          <ErrorBanner message={error} />

          {/* The case number. Red because it is the value being read aloud
              across the room, and red is what this design spends on the one
              thing that matters most on a screen. */}
          <div>
            <Eyebrow className="mb-2 text-dim">Case number</Eyebrow>
            <div
              className="flex h-[62px] items-center border border-red bg-panel px-4
                         font-mono text-[30px] text-red uppercase desktop:h-[76px] desktop:text-[36px]"
              style={{ letterSpacing: '0.3em' }}
            >
              {expectedRoomCode}
            </div>
          </div>

          <TextField
            label="Name for the record"
            value={name}
            onChange={setName}
            placeholder={say('As {they} {has} you saved')}
            maxLength={20}
            onEnter={handleJoin}
            autoFocus
          />

          <div>
            <Button onClick={handleJoin} disabled={busy}>
              {busy ? 'Taking a badge…' : 'Take a badge'}
            </Button>
            <FooterCaption className="mt-3">
              No player cap, just unique names. One of you still embarrasses yourself.
            </FooterCaption>
          </div>
        </Region>

        <Region edge="left" className="justify-center gap-3">
          {/* The explainer. It has one job: tell a player who has never seen
              this app what the shape of the night is, and that the badge they
              are about to be handed can go down as well as up. */}
          <Card className="!bg-paper !border-paper text-ink desktop:p-6">
            <Eyebrow className="mb-1.5 text-red-deep">What you are signing</Eyebrow>
            <p className="font-mono text-[13px] leading-[1.4] desktop:text-[14.5px] desktop:leading-[1.5]">
              {say('Eight ledgers on {name}. You start at')}{' '}
              <span className="uppercase" style={{ letterSpacing: '0.1em' }}>
                {BADGES[0].name}
              </span>
              . You will not stay there, and it cuts both ways.
            </p>
          </Card>

          <p className="text-[13.5px] leading-[1.5] text-dim">
            Use the name they know you by. Half of this game is people misspelling their own
            friends.
          </p>
        </Region>
      </div>
    </Screen>
  )
}
