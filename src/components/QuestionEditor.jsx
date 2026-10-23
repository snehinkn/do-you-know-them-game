import { useState } from 'react'
import { fillQuestion } from '../subject.js'

// ---------------------------------------------------------------------------
// EDITING THE QUESTIONS - the bank is a starting point, not the point. A host
// who knows their friend can edit a drawn question in place, remove a
// specific one, or write one of their own from scratch.
//
// The whole editor sits on STOCK - a light panel inside the dark sheet. That
// is the design's own move, and it earns its place: this is the one part of
// setup where the host reads and rewrites a lot of running text, and dark type
// on light paper is easier for that than the reverse.
//
// A question is edited as the FILLED text - what the host actually sees on
// screen, name and all - not the raw {name} token underneath. Typing a token
// back in is still possible, since it is just text, but nothing here forces
// the host to think in tokens. The trade-off is worth naming: an edited
// question stops re-reading if the guest of honour is renamed later, because
// it is no longer templated. A freshly written question was never templated to
// begin with, so this only affects a question edited in place.
//
// Split out of `HostSetupScreen.jsx`, where it used to live inline - it is
// only ever reached through that screen's single `<QuestionEditor>` usage and
// shares no other component or state with the rest of that file.
// ---------------------------------------------------------------------------

export function QuestionEditor({ category, roundType, questions, subject, bankSize, onAdd, onEdit, onRemove }) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="bg-paper px-4 pt-3.5 pb-4 text-ink">
      <div
        className="mb-2.5 flex flex-wrap justify-between gap-2 font-mono text-[9.5px] font-bold
                   text-red-deep uppercase"
        style={{ letterSpacing: '0.16em' }}
      >
        <span>Questions in the draw</span>
        <span>
          {bankSize} on file &middot; edit any of them
        </span>
      </div>

      {questions.map((question, index) => (
        <QuestionRow
          key={question.id}
          number={index + 1}
          question={question}
          roundType={roundType}
          subject={subject}
          canRemove={questions.length > 1}
          onEdit={(fields) => onEdit(question.id, fields)}
          onRemove={() => onRemove(question.id)}
        />
      ))}

      {adding ? (
        <AddQuestionForm
          category={category}
          roundType={roundType}
          onAdd={onAdd}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="focus-ring mt-2.5 font-impact text-[13px] text-red-deep uppercase"
        >
          + Add one of your own
        </button>
      )}
    </div>
  )
}

function QuestionRow({ number, question, roundType, subject, canRemove, onEdit, onRemove }) {
  const filled = fillQuestion(question, subject)
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(filled.text)
  const [draftTopic, setDraftTopic] = useState(filled.topic || '')
  const [draftItems, setDraftItems] = useState(filled.items || [])

  const isRank = roundType.inputType === 'rank'
  const hasTopic = 'topic' in question && question.topic !== null

  function commitAll() {
    const cleanText = draftText.trim()
    if (cleanText && cleanText !== filled.text) onEdit({ text: cleanText })

    if (hasTopic) {
      const cleanTopic = draftTopic.trim()
      if (cleanTopic && cleanTopic !== (filled.topic || '')) onEdit({ topic: cleanTopic })
    }

    if (isRank) {
      const cleanItems = draftItems.map((item) => item.trim())
      if (
        !cleanItems.some((item) => !item) &&
        JSON.stringify(cleanItems) !== JSON.stringify(filled.items || [])
      ) {
        onEdit({ items: cleanItems })
      }
    }

    setEditing(false)
  }

  function cancel() {
    setDraftText(filled.text)
    setDraftTopic(filled.topic || '')
    setDraftItems(filled.items || [])
    setEditing(false)
  }

  function setItem(index, value) {
    setDraftItems((current) => current.map((item, i) => (i === index ? value : item)))
  }

  const numeral = String(number).padStart(2, '0')

  if (!editing) {
    return (
      <div className="flex items-center gap-3 border-t-2 border-ink/15 py-2">
        <span className="w-[24px] shrink-0 font-mono text-[11px] font-bold">{numeral}</span>
        <span className="min-w-0 flex-1 text-[14.5px] leading-[1.35] font-medium">
          {filled.text}
          {isRank && filled.items?.length > 0 && (
            <span className="mt-0.5 block text-[12px] text-ink/55">
              {filled.items.join(' · ')}
            </span>
          )}
          {hasTopic && filled.topic && (
            <span className="mt-0.5 block font-mono text-[11px] text-red-deep uppercase">
              {filled.topic}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="focus-ring h-[34px] shrink-0 border-2 border-ink/30 px-2.5 font-body
                     text-[12px] font-bold uppercase"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove this question"
          title={canRemove ? 'Remove this question' : 'A ledger needs at least one question'}
          className="focus-ring grid h-[34px] w-[34px] shrink-0 place-items-center
                     disabled:cursor-not-allowed disabled:opacity-25"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="border-t-2 border-ink/15 py-2">
      <div className="flex items-start gap-3">
        <span className="mt-2.5 w-[24px] shrink-0 font-mono text-[11px] font-bold">{numeral}</span>
        <div className="min-w-0 flex-1">
          <StockField
            value={draftText}
            onChange={setDraftText}
            onEnter={commitAll}
            multiline={isRank}
          />

          {isRank && (
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {draftItems.map((item, index) => (
                <StockField
                  key={index}
                  value={item}
                  onChange={(value) => setItem(index, value)}
                  onEnter={commitAll}
                  placeholder={'Item ' + (index + 1)}
                  small
                />
              ))}
            </div>
          )}

          {hasTopic && (
            <div className="mt-1.5">
              <StockField
                value={draftTopic}
                onChange={setDraftTopic}
                onEnter={commitAll}
                placeholder="Topic shown while bidding"
                small
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={commitAll}
          className="focus-ring h-[40px] shrink-0 bg-red px-3.5 font-impact text-[12px]
                     text-bone uppercase"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="focus-ring h-[40px] shrink-0 px-1 font-body text-[12px] font-bold
                     text-ink/60 uppercase"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// One input on the stock panel. Kept as its own component so the editing row
// and the add form cannot drift apart.
function StockField({ value, onChange, onEnter, placeholder, small = false, multiline = false }) {
  const shared =
    'focus-ring w-full border-2 border-red bg-transparent px-2.5 font-body ' +
    'text-ink placeholder:text-ink/35 ' +
    (small ? 'text-[13px] ' : 'text-[14.5px] ')

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        placeholder={placeholder}
        className={shared + 'resize-none py-2'}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => event.key === 'Enter' && onEnter && onEnter()}
      placeholder={placeholder}
      className={shared + (small ? 'h-[36px]' : 'h-[40px]')}
    />
  )
}

function AddQuestionForm({ category, roundType, onAdd, onDone }) {
  const isRank = roundType.inputType === 'rank'
  const hasTopic = category.type === 'auction'
  const blankItems = isRank ? ['', '', '', '', ''] : []

  const [text, setText] = useState('')
  const [topic, setTopic] = useState('')
  const [items, setItems] = useState(blankItems)
  const [saving, setSaving] = useState(false)

  function setItem(index, value) {
    setItems((current) => current.map((item, i) => (i === index ? value : item)))
  }

  const ready =
    text.trim() !== '' &&
    (!hasTopic || topic.trim() !== '') &&
    (!isRank || items.every((item) => item.trim() !== ''))

  async function handleAdd() {
    if (!ready || saving) return
    setSaving(true)
    const input = { text: text.trim() }
    if (hasTopic) input.topic = topic.trim()
    if (isRank) input.items = items.map((item) => item.trim())

    const ok = await onAdd(category.id, input)
    setSaving(false)
    if (ok) {
      setText('')
      setTopic('')
      setItems(blankItems)
      onDone()
    }
  }

  return (
    <div className="mt-2.5 border-2 border-dashed border-ink/35 p-3">
      <div
        className="mb-2 font-mono text-[9.5px] font-bold text-red-deep uppercase"
        style={{ letterSpacing: '0.16em' }}
      >
        One of your own
      </div>

      <div className="flex flex-col gap-1.5">
        {hasTopic && (
          <StockField
            value={topic}
            onChange={setTopic}
            placeholder="Topic shown while bidding"
            small
          />
        )}

        <StockField
          value={text}
          onChange={setText}
          placeholder={isRank ? 'What are they ranking?' : 'Write it using their real name'}
        />

        {isRank && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((item, index) => (
              <StockField
                key={index}
                value={item}
                onChange={(value) => setItem(index, value)}
                placeholder={'Item ' + (index + 1)}
                small
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!ready || saving}
          className="focus-ring h-[40px] bg-red px-4 font-impact text-[12px] text-bone
                     uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Adding…' : 'Add question'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="focus-ring h-[40px] px-2 font-body text-[12px] font-bold text-ink/60
                     uppercase"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
