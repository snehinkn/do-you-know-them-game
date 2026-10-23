import { useState } from 'react'
import { HostLinkPanel, RoomPlate } from '../ui.jsx'
import DeleteGameControl from '../components/DeleteGameControl.jsx'
import { QuestionEditor } from '../components/QuestionEditor.jsx'
import { questionsInCategory, activeCategories, activePlayers } from '../gameHelpers.js'
import { ROUND_TYPES } from '../roundTypes.js'
import { identityFor } from '../roundIdentity.js'
import { TIERS, POWER_UPS, deckForTier } from '../powerUps.js'
import { bankSizeFor, maxQuestionsFor } from '../questionBank.js'
import { PRONOUN_CHOICES, DEFAULT_SUBJECT_NAME } from '../subject.js'
import { useSubject, useSay } from '../subjectContext.js'

// ---------------------------------------------------------------------------
// 2B - OPENING THE CASE. Host setup.
//
// The host does NOT have to write questions here. They come pre-written from
// the bank in `questionBank.js`. All the host must do is say who the night is
// about, then choose which ledgers to run, how long each is, and how dirty the
// favours get. Editing the questions is available on every ledger, and optional.
//
// NAMING THE SUBJECT IS THE FIRST THING ON THE SHEET, because every question
// below it is written about that person and reads as a blank until it has a
// name to use.
//
// THE ONE SCREEN THAT IS ALLOWED TO SCROLL.
//
// Everywhere else in this app, a screen that scrolls has a bug in it. This one
// is drawn by the design as a single 1180 x 1330 sheet - deliberately not a
// phone frame - so the whole running order is visible at once. On a real phone
// the two columns stack and it scrolls, which is correct: this is done sitting
// down before the party starts, not during it.
//
// The length control is a stepper rather than a text field on purpose: the
// range is one to about forty-eight, both ends matter, and it is being tapped
// with a thumb. Typing a number would need validating; a stepper cannot be
// wrong.
// ---------------------------------------------------------------------------

// Ledgers are numbered in roman on the bill, because a case file would be.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export default function HostSetupScreen({
  game,
  pendingCounts = {},
  onToggleCategory,
  onSetQuestionCount,
  onToggleLoserSupport,
  onSetPowerUpTier,
  onSetSubject,
  onAddOwnQuestion,
  onEditQuestion,
  onRemoveQuestion,
  onOpenLobby,
  onDeleteGame,
}) {
  const subject = useSubject()
  const say = useSay()
  const chosen = activeCategories(game)

  // Which ledgers have their question list open. Closed by default - the bill is
  // long enough already without every ledger's full question list showing.
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(() => new Set())

  function toggleExpanded(categoryId) {
    setExpandedCategoryIds((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  // The name is held locally while it is being typed and saved when the field
  // is let go of - one write per name rather than one per keystroke. The saved
  // value seeds it, so somebody else's edit still shows up.
  const savedName = game.subjectName === DEFAULT_SUBJECT_NAME ? '' : game.subjectName || ''
  const [draftName, setDraftName] = useState(savedName)

  function commitName() {
    const clean = draftName.trim()
    // An empty field means "I have not said yet", not "their name is nothing",
    // so it goes back to the default rather than saving a blank.
    const next = clean === '' ? DEFAULT_SUBJECT_NAME : clean
    if (next !== game.subjectName) onSetSubject({ subjectName: next })
  }

  // "No two players hold the same card" only holds while the deck is at least
  // as big as the group. Worth saying out loud rather than quietly dealing
  // repeats and letting the host find out mid-round.
  const tierKey = game.powerUpTier || 'basic'
  const tier = TIERS[tierKey] || TIERS.basic
  const playerCount = activePlayers(game).length
  // Counted from the actual deck rather than the tier's cut-off number. The
  // cut-off is "the first N cards", not a promise that N cards exist.
  const deckSize = deckForTier(POWER_UPS, tierKey).length
  const tooSmallForGroup = deckSize < playerCount

  // Everything on the bill's summary line is counted live, so it can never go
  // stale. Deliberately NOT a time estimate: the design's sheet says "~52 MIN"
  // and the app has no idea how long a round takes with a given group.
  const totalQuestions = chosen.reduce(
    (sum, category) =>
      sum + (pendingCounts[category.id] ?? questionsInCategory(game, category.id).length),
    0,
  )

  return (
    // The one screen bundle 3 allows to scroll on desktop, and the reason it
    // gets a sticky header rather than the pinned chrome every other screen
    // has: the bill is genuinely long, and the room code has to stay readable
    // while the host scrolls it.
    <div
      className="board-ground min-h-screen w-full text-ivory"
      style={{ containerType: 'inline-size' }}
    >
      <div>
        {/* --- The poster header, pinned ------------------------------------ */}
        <div className="gutter sticky top-0 z-20 bg-red py-4 text-bone desktop:py-[18px]">
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <div
                className="font-mono text-[10px] font-bold uppercase"
                style={{ letterSpacing: '0.2em' }}
              >
                File not yet open &middot; nothing is binding
              </div>
              <div
                className="mt-1.5 font-impact uppercase"
                style={{
                  fontSize: 'clamp(34px, 5cqw, 60px)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.04em',
                }}
              >
                Build the case
              </div>
            </div>

            <div className="flex items-end gap-5">
              <div
                className="hidden text-right font-mono text-[10px] leading-[1.7] font-bold
                           uppercase sm:block"
                style={{ letterSpacing: '0.14em' }}
              >
                Every ledger is optional
                <br />
                {say('{Their} verdict is not')}
                <br />
                Bring who you like
              </div>
              <RoomPlate code={game.roomCode} />
            </div>
          </div>
        </div>

        {/* --- Three columns on a laptop, one on a phone --------------------
            The bundle's own setup frame runs 330px of settings, the bill in the
            middle taking whatever is left, and a 320px rail on the right that
            stays put while the bill scrolls past it. Below the breakpoint they
            stack in the order a thumb wants them: settings, bill, then the
            button. */}
        <div className="gutter grid gap-7 pt-7 pb-12 desktop:grid-cols-[330px_1fr_320px] desktop:items-start desktop:gap-7">
          {/* THE LEFT-HAND COLUMN: who, and under what rules. */}
          <div className="flex w-full min-w-0 flex-col gap-6">
            <div>
              <SheetLabel accent>Who are we looking at</SheetLabel>
              <input
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => event.key === 'Enter' && commitName()}
                placeholder="PRIYA"
                maxLength={40}
                aria-label="Their name"
                // The one field the whole night is about, and the bundle draws
                // it unlike every other field: bone paper, the display face,
                // and a 4px red rule under it rather than a box.
                className="focus-ring h-[54px] w-full border-0 border-b-4 border-red bg-paper
                           px-4 font-impact text-[24px] uppercase text-ink
                           placeholder:text-ink-dashed desktop:h-[62px] desktop:text-[28px]"
              />
              <Note>
                Goes into every question tonight. You can change it any time before the room
                opens.
              </Note>
            </div>

            <div>
              <SheetLabel>{say('Words for {them}')}</SheetLabel>
              <Segmented
                options={PRONOUN_CHOICES.map((choice) => ({
                  key: choice.value,
                  label: choice.label,
                }))}
                value={subject.pronouns}
                onChange={(value) => onSetSubject({ subjectPronouns: value })}
              />
              <Note italic>
                {say(
                  'Only used where a sentence needs one — most of the game says the name instead. Right now it reads: “{name} scores, and {they} {is} never wrong.”',
                )}
              </Note>
            </div>

            <div className="border-t-2 border-rule pt-5">
              <SheetLabel accent>Favours owed</SheetLabel>
              <div className="font-impact text-[16px] uppercase">How dirty can they play</div>
              <Note>
                Cards detectives can spend mid-ledger. Each tier includes the one below it.
              </Note>
              <div className="mt-2.5">
                <Segmented
                  options={Object.values(TIERS).map((option) => ({
                    key: option.key,
                    label: option.label,
                  }))}
                  value={tierKey}
                  onChange={onSetPowerUpTier}
                />
              </div>
              <Note italic>{tier.blurb}</Note>
              {tooSmallForGroup && (
                <p className="mt-2 font-mono text-[11px] text-red uppercase">
                  {deckSize} cards between {playerCount}{' '}
                  {playerCount === 1 ? 'detective' : 'detectives'} means some get dealt twice.
                </p>
              )}
            </div>

            <div className="flex items-start justify-between gap-3.5 border-t-2 border-rule pt-4">
              <div>
                <div className="font-impact text-[15px] uppercase">Pity the last man</div>
                <Note className="max-w-[30ch]">
                  Whoever finishes a ledger last carries a favour into the next one.
                </Note>
              </div>
              <Switch on={game.loserSupportEnabled} onClick={onToggleLoserSupport} label="Pity the last man" />
            </div>

          </div>

          {/* THE BILL. Ordered second on a phone and in the middle on a laptop,
              which is the same place in both. */}
          <div className="order-2 flex min-w-0 flex-col gap-3.5 desktop:order-none">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-red pb-2.5">
              <span className="font-impact text-[24px] uppercase desktop:text-[30px]">
                Tonight&rsquo;s bill
              </span>
              <span
                className="font-mono text-[10.5px] font-bold text-dim uppercase"
                style={{ letterSpacing: '0.2em' }}
              >
                {chosen.length} {chosen.length === 1 ? 'ledger' : 'ledgers'} running &middot;{' '}
                {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
              </span>
            </div>

            {game.categories.map((category, index) => {
              const roundType = ROUND_TYPES[category.type] || ROUND_TYPES.typed
              const identity = identityFor(category.type)
              // The number last tapped wins over the number the database has,
              // until the database catches up. Waiting for the round trip made
              // every tap feel like it had not registered.
              const dealtCount = questionsInCategory(game, category.id).length
              const questionCount = pendingCounts[category.id] ?? dealtCount
              // Two different numbers since the bank grew to five thousand:
              // how many questions exist for this round (what "on file" means
              // to a host reading the screen), and the most one round may be
              // set to, which is a rules decision and far smaller.
              const bankSize = bankSizeFor(category.type)
              const maxCount = maxQuestionsFor(category.type)
              const isOn = category.included !== false
              const isOpen = expandedCategoryIds.has(category.id)

              return (
                <LedgerRow
                  key={category.id}
                  numeral={ROMAN[index] || String(index + 1)}
                  identity={identity}
                  name={say(roundType.label)}
                  tagline={say(roundType.blurb)}
                  bankSize={bankSize}
                  maxCount={maxCount}
                  count={questionCount}
                  isOn={isOn}
                  isOpen={isOpen}
                  onToggleOn={() => onToggleCategory(category.id)}
                  onToggleOpen={() => toggleExpanded(category.id)}
                  onStep={(next) => onSetQuestionCount(category.id, next)}
                  editor={
                    isOpen && (
                      <QuestionEditor
                        category={category}
                        roundType={roundType}
                        questions={questionsInCategory(game, category.id)}
                        subject={subject}
                        bankSize={bankSize}
                        onAdd={onAddOwnQuestion}
                        onEdit={onEditQuestion}
                        onRemove={onRemoveQuestion}
                      />
                    )
                  }
                />
              )
            })}
          </div>

          {/* THE ACTION RAIL. Sticky on a laptop so "Open the room" stays under
              the host's cursor however far down the bill they scroll; ordered
              last on a phone, where it simply sits at the bottom of the
              sheet. */}
          <div className="order-3 flex w-full min-w-0 flex-col gap-5 desktop:order-none desktop:sticky desktop:top-[110px]">
            <div>
              <button
                type="button"
                onClick={onOpenLobby}
                disabled={chosen.length === 0}
                className="focus-ring flex h-[62px] w-full items-center justify-between px-5
                           font-impact text-[21px] uppercase desktop:h-[78px] desktop:text-[23px]
                           disabled:cursor-not-allowed
                           enabled:bg-red enabled:text-bone enabled:hover:bg-red-deep
                           disabled:bg-line disabled:text-dim"
                style={{ letterSpacing: '-0.02em' }}
              >
                Open the room
                <span className="font-mono text-[20px]" aria-hidden="true">
                  &rarr;
                </span>
              </button>
              {chosen.length === 0 && (
                <p
                  className="mt-2.5 font-mono text-[10px] font-bold uppercase text-red-bright"
                  style={{ letterSpacing: '0.18em' }}
                >
                  Turn on at least one ledger first
                </p>
              )}
            </div>

            {/* The earliest chance to get a spare copy of the host link
                somewhere safe. Repeated on the lobby, because this one is easy
                to scroll past while picking ledgers. */}
            <HostLinkPanel />

            {onDeleteGame && (
              <div className="border-t-2 border-rule pt-4">
                <DeleteGameControl onDelete={onDeleteGame} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SHEET FURNITURE
// ---------------------------------------------------------------------------

function SheetLabel({ children, accent = false, className = '' }) {
  return (
    <div
      className={
        'mb-2 font-mono text-[10px] uppercase ' +
        (accent ? 'text-red ' : 'text-ghost ') +
        className
      }
      style={{ letterSpacing: '0.18em' }}
    >
      {children}
    </div>
  )
}

function Note({ children, italic = false, className = '' }) {
  return (
    <p
      className={
        'mt-[7px] text-[12.5px] leading-[1.5] text-ghost ' +
        (italic ? 'italic ' : '') +
        className
      }
    >
      {children}
    </p>
  )
}

// A row of joined buttons in one 2px box - pronouns, and the favour tiers. The
// chosen one is a filled red field; the rest are bare.
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex border-2 border-line">
      {options.map((option, index) => {
        const active = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={
              'focus-ring h-[46px] min-w-0 flex-1 truncate px-1 text-[13px] uppercase ' +
              (index < options.length - 1 ? 'border-r-2 border-line ' : '') +
              (active
                ? 'bg-red font-impact text-bone'
                : 'font-body font-semibold text-dim hover:text-ivory')
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// A square-cornered switch, because nothing in this design is round.
function Switch({ on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={
        'focus-ring relative h-[32px] w-[62px] shrink-0 border-2 ' +
        (on ? 'border-red' : 'border-line')
      }
    >
      <span
        className={
          'absolute top-[2px] h-[24px] w-[24px] transition-[left] ' +
          (on ? 'left-[32px] bg-red' : 'left-[2px] bg-line')
        }
      />
    </button>
  )
}

// A 44px square key. A thumb, on a phone, pressing repeatedly.
//
// Disabled while a write is in flight. Each press deals a question in or takes
// one out, and a double-tap on a slow connection would otherwise queue up two
// changes against a count that has not caught up yet.
function StepKey({ onClick, label, disabled, glyph }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="focus-ring grid h-[44px] w-[44px] shrink-0 place-items-center border-2
                 border-line text-[20px] text-ivory disabled:cursor-not-allowed
                 disabled:opacity-30"
      dangerouslySetInnerHTML={{ __html: glyph }}
    />
  )
}

// ---------------------------------------------------------------------------
// ONE LEDGER ON THE BILL
//
// Closed, it is a single row: numeral, mark, name, tagline, stepper, edit,
// and whether it is running. The design's note about this row is the piece to
// get right - the TAGLINE stays on one line and flexes, the NAME shrinks and
// truncates before anything else, and the redundant bank count hides on a
// narrow screen. That ordering is what stops the row wrapping into three lines
// on a phone.
//
// Open, the row grows a red header, a "how many" strip and the question list.
// ---------------------------------------------------------------------------
function LedgerRow({
  numeral,
  identity,
  name,
  tagline,
  bankSize,
  maxCount,
  count,
  isOn,
  isOpen,
  onToggleOn,
  onToggleOpen,
  onStep,
  editor,
}) {
  const mark = (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="hidden shrink-0 sm:block"
      aria-hidden="true"
    >
      <path d={identity.mark} />
    </svg>
  )

  return (
    <div
      className={
        'border-2 ' +
        (isOpen ? 'border-red ' : isOn ? 'border-rule ' : 'border-rule opacity-55 ')
      }
    >
      {/* The row itself. Filled red when its editor is open, so it reads as
          the head of the panel below it rather than as another row. */}
      <div
        className={
          'flex flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-2.5 ' +
          (isOpen ? 'bg-red text-bone' : '')
        }
      >
        <span
          className={
            'w-[34px] shrink-0 font-impact text-[22px] ' +
            (isOpen ? '' : isOn ? 'text-red' : 'text-dim')
          }
        >
          {numeral}
        </span>

        {mark}

        <span className="min-w-0 flex-[0_1_auto] truncate font-impact text-[19px] uppercase">
          {name}
        </span>

        <span
          className={
            'min-w-0 flex-[1_1_200px] truncate text-[13px] ' +
            (isOpen ? 'font-medium' : 'text-dim')
          }
        >
          {tagline}
        </span>

        {/* The bank count is the first thing to go on a narrow screen: it is
            already implied by the stepper's ceiling. */}
        <span
          className={
            'hidden shrink-0 font-mono text-[10px] font-bold uppercase xl:inline ' +
            (isOpen ? '' : 'text-ghost')
          }
          style={{ letterSpacing: '0.12em' }}
        >
          {bankSize} on file
        </span>

        <button
          type="button"
          onClick={onToggleOn}
          aria-pressed={isOn}
          className={
            'focus-ring shrink-0 border-2 px-3 py-1 font-mono text-[10px] font-bold uppercase ' +
            (isOpen
              ? 'border-ink bg-page text-red'
              : isOn
                ? 'border-red text-red'
                : 'border-line text-dim')
          }
          style={{ letterSpacing: '0.14em' }}
        >
          {isOn ? 'Running' : 'Benched'}
        </button>
      </div>

      {/* Setting the length of a ledger nobody is playing is a control that does
          nothing, and this bill is long enough already. */}
      {isOn && (
        <div
          className={
            'flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 ' +
            (isOpen ? 'border-b-2 border-rule' : 'border-t-2 border-rule')
          }
        >
          <span
            className="font-mono text-[10px] text-ghost uppercase"
            style={{ letterSpacing: '0.16em' }}
          >
            How many
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-[12.5px] text-ghost sm:inline">
            Drawn at random from the file. No two nights run the same.
          </span>

          <div className="flex shrink-0 items-center gap-2.5">
            <StepKey
              label={'One fewer ' + name + ' question'}
              glyph="&minus;"
              disabled={count <= 1}
              onClick={() => onStep(count - 1)}
            />
            <span className="min-w-[26px] text-center font-impact text-[22px]">{count}</span>
            <StepKey
              label={'One more ' + name + ' question'}
              glyph="+"
              disabled={count >= maxCount}
              onClick={() => onStep(count + 1)}
            />
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            className={
              'focus-ring h-[44px] shrink-0 border-2 px-3.5 font-impact text-[12.5px] uppercase ' +
              (isOpen
                ? 'border-red text-red'
                : 'border-line text-dim hover:text-ivory')
            }
          >
            {isOpen ? 'Close editor' : 'Edit'}
          </button>
        </div>
      )}

      {editor}
    </div>
  )
}

