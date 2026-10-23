import {
  Screen,
  Region,
  HeadlineBand,
  Clock,
  PlayerTag,
  Button,
  TextLink,
  Title,
  Impact,
  Eyebrow,
  Rule,
  FooterCaption,
  EmptySlot,
  LiveNote,
  RankLadder,
  RoomCodeBadge,
  BadgeCard,
  HostLinkPanel,
} from '../ui.jsx'
import { activePlayers } from '../gameHelpers.js'
import { badgeAt, STARTING_BADGE } from '../badge.js'
import { PRONOUN_CHOICES } from '../subject.js'
import { useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// THE MUSTER (host) and PLAYER WAITING.
//
// Both sides of the same moment: people are arriving, and the host is deciding
// when to stop waiting. The host gets the case number and the roster; the
// player gets their badge.
//
// The roster deliberately shows a player's NAME and a badge number and nothing
// else - no round marks, no aliases. The round aliases are the disguise the
// judging screens hide behind, and if the lobby ever paired a player with one,
// the subject would learn the mapping here and read it all night.
//
// BADGE NUMBERS ARE DERIVED, NOT STORED. A badge number is simply where you
// come in the join order, counted at render. There is no column for it and
// there does not need to be: `activePlayers` returns players in the order they
// joined, so the first person to arrive is 01 and stays 01. Same discipline as
// the badge rank itself - nothing about a player is written down that can be
// worked out from what is already there.
//
// WHAT BUNDLE 3'S OWN MUSTER FRAME ASSUMES, AND WHAT IS PORTED
//
// The design's README describes the host reading a shared "room screen" that
// the whole party can see. This app does not work that way and never has: every
// participant, host included, is on their own private device (`HANDOFF-7.md`
// §3, re-confirmed twice since). So the three-column composition, the empty
// badge slots, the paper case-number card and the chrome all port directly -
// they are just a wide layout of one person's own screen - while nothing that
// only makes sense on a TV in the corner does.
// ---------------------------------------------------------------------------

// Badge numbers read as 01, 02 - a two-digit file number, not a score.
function badgeNumber(index) {
  return String(index + 1).padStart(2, '0')
}

// How many empty slots to draw beside the people who have actually arrived.
// The design fills its roster grid out to a full board, which is what makes an
// empty muster read as "waiting" rather than "broken" - but it must never imply
// a cap the game does not have, so this only ever pads the current row out.
function openSlots(count, columns) {
  if (count === 0) return columns * 2
  const remainder = count % columns
  return remainder === 0 ? columns : columns - remainder
}

export default function LobbyScreen({ game, isHost, meId, onStart, onBackToEditor }) {
  const say = useSay()
  const roster = activePlayers(game)
  const questionCount = game.questions.length

  return isHost ? (
    <Muster
      game={game}
      roster={roster}
      questionCount={questionCount}
      onStart={onStart}
      onBackToEditor={onBackToEditor}
      say={say}
    />
  ) : (
    <SignedIn game={game} roster={roster} meId={meId} say={say} />
  )
}

// ---------------------------------------------------------------------------
// THE HOST: read the number out, watch people arrive, start the case.
// ---------------------------------------------------------------------------
function Muster({ game, roster, questionCount, onStart, onBackToEditor, say }) {
  const pronounLabel =
    PRONOUN_CHOICES.find((choice) => choice.value === game.subjectPronouns)?.label || 'they / them'

  // The design's headline is "Five signed in. One still finding the app." The
  // second sentence is a lie this app cannot tell - it has no idea whether
  // anybody else is coming - so the count carries the line on its own.
  const headline =
    roster.length === 0
      ? 'Nobody yet. Read the number out.'
      : roster.length === 1
        ? 'One signed in. It is a start.'
        : `${roster.length} signed in.`

  const blocked = questionCount === 0 || roster.length === 0
  const blockedReason =
    questionCount === 0
      ? 'No questions drawn yet — go back and turn a ledger on'
      : 'Waiting for at least one detective'

  return (
    <Screen
      fixed
      pad={false}
      status={{
        left: (
          <>
            The muster · <span className="text-red">reporting in</span>
          </>
        ),
        right: 'Case ' + game.roomCode + ' · host view',
      }}
      footer={{
        left: 'Room open · anyone with the number can walk in',
        right: game.roomCode,
      }}
    >
      <HeadlineBand>
        <Title size="lg">{headline}</Title>
      </HeadlineBand>

      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[430px_1fr_340px]">
        {/* ── The briefing ──────────────────────────────────────────────── */}
        <Region edge="right" className="gap-5 desktop:gap-5">
          <RoomCodeBadge
            code={game.roomCode}
            note={say('The suspect is {name}, and {they} can hear you.')}
          />

          {/* Who the night is about. The design labels this "LOCKED"; it is
              not - the host can still go back and rename, and the button to do
              that is on this very screen. */}
          <div className="border border-rule border-l-[5px] border-l-red bg-panel px-4 py-3.5 desktop:px-[18px] desktop:py-4">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow className="text-red-bright" size={9.5} tracking="0.2em">
                Subject of the case
              </Eyebrow>
              {/* The pronoun set as the setup screen words it - "they / them" -
                  rather than assembled from tokens, which gave "their / them". */}
              <Eyebrow className="shrink-0 text-dim" size={9.5} tracking="0.2em">
                {pronounLabel}
              </Eyebrow>
            </div>
            <Impact size={28} className="mt-1.5 text-ivory">
              {say('{name}')}
            </Impact>
            <p className="mt-1 font-body text-[13px] text-warm italic desktop:text-[14px]">
              present, and enjoying this far too much
            </p>
          </div>

          {/* The last calm moment before the game starts, and so the right one
              to nudge the host into stashing a spare copy of their link. */}
          <HostLinkPanel className="mt-2 desktop:mt-3" />
        </Region>

        {/* ── Who has turned up ─────────────────────────────────────────── */}
        <Region className="min-h-0 gap-3.5">
          <div className="flex shrink-0 items-baseline justify-between border-b-2 border-rule pb-[9px]">
            <Eyebrow className="text-red" size={9.5} tracking="0.22em">
              Detectives reporting
            </Eyebrow>
            <Eyebrow className="shrink-0 text-dim" size={9.5} tracking="0.22em">
              {roster.length} {roster.length === 1 ? 'badge' : 'badges'} issued
            </Eyebrow>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-2.5 desktop:gap-3">
              {roster.map((player, index) => (
                <div
                  key={player.id}
                  className="flex min-h-[52px] flex-col items-center justify-center gap-1 border-2
                             border-line bg-panel px-2 py-2 text-center"
                >
                  <span className="font-mono text-[15px] text-red-bright desktop:text-[22px]">
                    {badgeNumber(index)}
                  </span>
                  <span className="w-full truncate font-body text-[11px] text-ivory desktop:text-[13px]">
                    {player.displayName}
                  </span>
                </div>
              ))}
              {Array.from({ length: openSlots(roster.length, 3) }, (_, index) => (
                <EmptySlot key={'open-' + index} />
              ))}
            </div>
          </div>

          <p className="shrink-0 font-body text-[13px] text-warm italic desktop:text-[14.5px]">
            {roster.length === 0
              ? 'Nobody has signed in yet. Nothing happens until somebody does.'
              : say('Everyone here reckons they know {name}. Most of them are wrong.')}
          </p>
        </Region>

        {/* ── When they are in ──────────────────────────────────────────── */}
        <Region edge="left" className="justify-between gap-5">
          <div className="flex flex-col gap-3.5">
            <Eyebrow className="text-dim" size={10} tracking="0.24em">
              When they are in
            </Eyebrow>
            <Button onClick={onStart} disabled={blocked}>
              Open ledger I
            </Button>
            {blocked && <LiveNote>{blockedReason}</LiveNote>}
          </div>

          <div className="flex flex-col gap-4">
            <TextLink onClick={onBackToEditor} className="self-start">
              Back to the bill
            </TextLink>
            <FooterCaption>
              Starting without the stragglers is a decision you can live with.
            </FooterCaption>
          </div>
        </Region>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// THE PLAYER: confirm you are in, and hand over the badge.
//
// The badge card is the player's anchor object. This is the first time they see
// it; it comes back in the status strip of every later screen, and at full size
// on the rank card.
//
// ONE THING THE CANVAS DRAWS THAT THIS SCREEN DELIBERATELY DOES NOT: a "Change
// my name" control. There is no rename path anywhere in this app - `joinGame`
// is a one-time insert - and the design bundle is explicit that this is a
// visual pass with no new backend contract. A misspelled name today means
// asking a neighbour to read the badge back to you, which is a fine enough
// party foul.
// ---------------------------------------------------------------------------
function SignedIn({ game, roster, meId, say }) {
  const myIndex = roster.findIndex((player) => player.id === meId)
  const badgeNo = myIndex >= 0 ? badgeNumber(myIndex) : '--'
  const me = myIndex >= 0 ? roster[myIndex] : null
  const others = roster.length - 1

  return (
    <Screen
      fixed
      pad={false}
      status={{
        left: <Clock />,
        right: <PlayerTag badgeNo={badgeNo} badge={badgeAt(STARTING_BADGE)} />,
      }}
      footer={{
        left: me ? 'Signed in as ' + me.displayName : 'Signed in',
        right: 'Case ' + game.roomCode,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col desktop:grid desktop:grid-cols-[520px_1fr]">
        <Region edge="right" className="gap-5 desktop:gap-[22px]">
          <BadgeCard
            badgeNo={badgeNo}
            badge={badgeAt(STARTING_BADGE)}
            roomCode={game.roomCode}
          />
          {/* Every player is on the first rank here, since nobody has played a
              question yet - the design's own lobby frame draws it that way too,
              not just as a shortcut. */}
          <RankLadder at={STARTING_BADGE} />
          <FooterCaption>
            Rank moves when the points do. Nothing you can do about it from here.
          </FooterCaption>
        </Region>

        <Region className="min-h-0 justify-between gap-5">
          <div className="flex flex-col gap-3">
            <Title size="lg">Wait for the precinct.</Title>
            <p className="font-body text-[14.5px] leading-[1.5] text-warm desktop:text-[16px]">
              {others > 0
                ? `${others} other${others === 1 ? '' : 's'} signed the same sheet. `
                : 'Nobody else has signed the same sheet yet. '}
              {others > 0 && say('One of them thinks they know {name} better than you do.')}
            </p>
          </div>

          <div className="flex flex-col gap-3 py-5">
            <Eyebrow className="shrink-0 border-b-2 border-rule pb-2 text-red" size={10} tracking="0.24em">
              On the roster
            </Eyebrow>
            <div>
              <div className="flex flex-wrap gap-2.5">
                {roster.map((player) => {
                  const isMe = player.id === meId
                  return (
                    <span
                      key={player.id}
                      className={
                        'border-2 px-3 py-2 font-mono text-[10.5px] font-bold uppercase desktop:text-[11px] ' +
                        (isMe ? 'border-red text-red-bright' : 'border-line text-ivory')
                      }
                      style={{ letterSpacing: '0.16em' }}
                    >
                      {player.displayName}
                      {isMe && ' · you'}
                    </span>
                  )
                })}
                {Array.from({ length: openSlots(roster.length, 3) }, (_, index) => (
                  <span
                    key={'open-' + index}
                    className="border-2 border-dashed border-rule px-3 py-2 font-mono text-[10.5px]
                               font-bold uppercase text-ghost desktop:text-[11px]"
                    style={{ letterSpacing: '0.16em' }}
                  >
                    Badge open
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="reserve-exit flex shrink-0 flex-col gap-2.5">
            <Rule className="mb-1" />
            <LiveNote>{say('Waiting on {name} to open the file')}</LiveNote>
            <FooterCaption>Phone stays in your hand all night.</FooterCaption>
          </div>
        </Region>
      </div>
    </Screen>
  )
}
