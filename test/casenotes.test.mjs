// The case board on the landing screen.
//
// These notes are the one piece of copy in the app that has to read correctly
// with NO game loaded at all - no name, and no pronoun setting either. That is
// a different constraint from the question bank, which always has both, and it
// is the reason this pool gets its own sweep rather than riding along on the
// bank's.
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CASE_NOTES, BOARD_SLOTS, pickCaseNotes } from '../src/caseNotes.js'
import { fill, subjectFrom } from '../src/subject.js'

// The three settings a note has to survive. `nobody` is the important one: it
// is what the landing screen actually has before a case number is typed.
const nobody = subjectFrom({})
const she = subjectFrom({ subjectName: 'Priya', subjectPronouns: 'she' })
const they = subjectFrom({ subjectName: 'Sam', subjectPronouns: 'they' })

// --- The rules the pool must obey ------------------------------------------

// The landing screen usually has no game, so there is no name to put in. A
// note carrying {name} would print "the guest of honour" in the middle of a
// clipped one-line case note, which reads as a bug rather than as a joke.
test('no note asks for a name, because the landing screen has not got one', () => {
  CASE_NOTES.forEach((note) => {
    assert.ok(!/\{name\}/i.test(note.text), 'note uses {name}: ' + note.text)
    assert.ok(!/\{name\}/i.test(note.meta), 'meta uses {name}: ' + note.meta)
  })
})

test('every token in every note is one the app can actually fill', () => {
  CASE_NOTES.forEach((note) => {
    const filled = fill(note.text, nobody)
    assert.ok(
      !/\{[A-Za-z]+\}/.test(filled),
      'note has a token nothing fills: ' + note.text + ' -> ' + filled,
    )
  })
})

// The trap `subject.js` is built around: singular "they" takes the plural
// verb, so a note written for "she" reads broken for "they".
test('no note puts {they} in front of a verb without agreement', () => {
  CASE_NOTES.forEach((note) => {
    const filled = fill(note.text, they)
    assert.ok(
      !/\bthey (is|was|has|does|goes|wants|says|likes|knows|thinks)\b/i.test(filled),
      'reads wrong for they/them: ' + filled,
    )
  })
})

test('every note reads as English under all three pronoun settings', () => {
  CASE_NOTES.forEach((note) => {
    ;[nobody, she, they].forEach((subject) => {
      const filled = fill(note.text, subject)
      assert.ok(filled.length > 0)
      assert.ok(!/\s{2,}/.test(filled), 'double space in: ' + filled)
      assert.ok(/[.!?]$/.test(filled.trim()), 'note does not end in a stop: ' + filled)
    })
  })
})

// A note is pinned to a board and read across a room. Anything that doubles as
// a security question does not go on it.
test('nothing on the board doubles as a password-recovery question', () => {
  const banned = /first pet|maiden name|first school|street you grew up|mother's maiden/i
  CASE_NOTES.forEach((note) => {
    assert.ok(!banned.test(note.text), 'security-question material: ' + note.text)
  })
})

// The pool has to be comfortably bigger than the board, or the same four notes
// turn up every time and the board stops being worth looking at.
test('there are plenty more notes than the board can hold', () => {
  assert.ok(
    CASE_NOTES.length >= BOARD_SLOTS.length * 3,
    'pool is too small to feel varied: ' + CASE_NOTES.length,
  )
})

// --- The picker -------------------------------------------------------------

test('the board fills every slot, with no note twice', () => {
  const picked = pickCaseNotes('CBD8R')
  assert.equal(picked.length, BOARD_SLOTS.length)
  const texts = new Set(picked.map((n) => n.text))
  assert.equal(texts.size, BOARD_SLOTS.length, 'the same note appeared twice on one board')
})

// This is the whole reason the pick is seeded rather than a call to
// Math.random inside the component: notes that reshuffled on every re-render
// would make the board flicker while somebody types their name into the field
// directly underneath it.
test('the same seed always gives the same board', () => {
  assert.deepEqual(pickCaseNotes('CBD8R'), pickCaseNotes('CBD8R'))
  assert.deepEqual(pickCaseNotes(''), pickCaseNotes(''))
})

test('different seeds give different boards', () => {
  const a = pickCaseNotes('CBD8R').map((n) => n.text).join('|')
  const b = pickCaseNotes('YS7KV').map((n) => n.text).join('|')
  assert.notEqual(a, b)
})

test('asking for more notes than exist returns everything, not a repeat', () => {
  const picked = pickCaseNotes('seed', CASE_NOTES.length + 5)
  assert.equal(picked.length, CASE_NOTES.length)
  assert.equal(new Set(picked.map((n) => n.text)).size, CASE_NOTES.length)
})
