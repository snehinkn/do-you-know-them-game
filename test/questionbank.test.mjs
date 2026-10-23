// The question bank and the random draw that deals from it.
//
// The draw is the only place in the app where the same question could be asked
// twice in one night, or where nudging a round's length could quietly reshuffle
// the questions already chosen. Both are the kind of thing nobody notices until
// it happens in front of everyone, so they are pinned here.
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORY_SETUP,
  MAX_QUESTIONS_PER_ROUND,
  QUESTION_BANK,
  bankFor,
  bankSizeFor,
  defaultCountFor,
  drawQuestions,
  maxQuestionsFor,
} from '../src/questionBank.js'

// Every round in the running order is playable now - there is no hidden one.
const PLAYABLE = CATEGORY_SETUP.map((c) => c.type)

test('every round in the running order has questions written for it', () => {
  CATEGORY_SETUP.forEach((category) => {
    assert.ok(
      maxQuestionsFor(category.type) > 0,
      category.type + ' is in the running order with an empty bank',
    )
  })
})

// Draws exclude what is already in play by matching on text, because a drawn
// question has no other identity until the database gives it one. Two questions
// worded the same would make one of them undrawable.
test('question text is unique across the whole bank', () => {
  const seen = new Set()

  Object.values(QUESTION_BANK).forEach((questions) => {
    questions.forEach((question) => {
      assert.ok(!seen.has(question.text), 'duplicated question: ' + question.text)
      seen.add(question.text)
    })
  })
})

test('every ranking question offers exactly five things to order', () => {
  bankFor('rank').forEach((question) => {
    assert.equal(question.items.length, 5, 'wrong item count: ' + question.text)
    assert.equal(new Set(question.items).size, 5, 'repeated item in: ' + question.text)
  })
})

test('every auction question has a topic to bid on', () => {
  bankFor('auction').forEach((question) => {
    assert.ok(question.topic && question.topic.length > 0, 'no topic: ' + question.text)
  })
})

test('a round never opens with more questions than it has written', () => {
  PLAYABLE.forEach((type) => {
    const count = defaultCountFor(type)
    assert.ok(count >= 1, type + ' opens with no questions')
    assert.ok(count <= maxQuestionsFor(type), type + ' opens with more than it has')
  })
})

test('a draw never repeats a question', () => {
  PLAYABLE.forEach((type) => {
    const drawn = drawQuestions(type, maxQuestionsFor(type))
    const texts = new Set(drawn.map((q) => q.text))
    assert.equal(texts.size, drawn.length, type + ' dealt the same question twice')
  })
})

// Note this asks for more than the BANK holds, not more than a round may be
// set to. Those were the same number until 4 September, when the bank grew to
// five thousand and a separate per-round ceiling was introduced.
test('asking for more than exists returns everything, not a repeat', () => {
  const size = bankSizeFor('fib')
  const drawn = drawQuestions('fib', size + 50)
  assert.equal(drawn.length, size)
})

// The ceiling is a rules decision, not a fact about the bank (Snehin,
// 4 September): a round may be set to at most fifteen questions however many
// are written for it, and every round has far more than fifteen.
test('no round can be set to more than fifteen questions', () => {
  PLAYABLE.forEach((type) => {
    assert.equal(
      maxQuestionsFor(type),
      MAX_QUESTIONS_PER_ROUND,
      type + ' does not stop at the per-round ceiling',
    )
    assert.ok(
      bankSizeFor(type) > MAX_QUESTIONS_PER_ROUND,
      type + ' has too few questions to fill a full-length round',
    )
  })
})

// The whole point of growing the bank: a round drawn twice should almost never
// be the same round. With the smallest pool at 400 and a round at most 15,
// two independent draws sharing every question is vanishingly unlikely.
test('two draws of the same round are not the same questions', () => {
  PLAYABLE.forEach((type) => {
    const a = drawQuestions(type, 5).map((q) => q.text).join('|')
    let differed = false
    for (let i = 0; i < 20; i++) {
      if (drawQuestions(type, 5).map((q) => q.text).join('|') !== a) {
        differed = true
        break
      }
    }
    assert.ok(differed, type + ' drew the same five questions twenty times running')
  })
})

// Guards the headline number against a later edit quietly deleting a chunk of
// it. Five thousand was the target; this asserts the floor, not the exact count.
test('the bank holds at least five thousand questions', () => {
  const total = Object.values(QUESTION_BANK).reduce((sum, list) => sum + list.length, 0)
  assert.ok(total >= 5000, 'the bank has shrunk to ' + total)
})

// What makes "one more question" safe: the round the host is looking at stays
// exactly as it is, and the new question comes from what is left over.
test('a draw skips the questions already in play', () => {
  const inPlay = drawQuestions('typed', 3)
  const texts = inPlay.map((q) => q.text)

  const more = drawQuestions('typed', 2, texts)
  assert.equal(more.length, 2)
  more.forEach((question) => {
    assert.ok(!texts.includes(question.text), 'redealt a question already in play')
  })
})

test('a draw with everything excluded comes back empty rather than repeating', () => {
  const all = bankFor('pitch').map((q) => q.text)
  assert.deepEqual(drawQuestions('pitch', 3, all), [])
})

test('the draw is actually random', () => {
  // Twenty draws of five from seventeen. Identical every time means the shuffle
  // is not shuffling; one repeat is chance, twenty is not.
  const first = drawQuestions('typed', 5).map((q) => q.text).join('|')
  let differed = false

  for (let i = 0; i < 20; i++) {
    if (drawQuestions('typed', 5).map((q) => q.text).join('|') !== first) {
      differed = true
      break
    }
  }

  assert.ok(differed, 'the draw returned the same questions every time')
})

test('nothing carries an answer key out of the bank', () => {
  Object.values(QUESTION_BANK).forEach((questions) => {
    questions.forEach((question) => {
      assert.equal(question.trueAnswer, undefined)
      assert.equal(question.trueNumber, undefined)
      assert.equal(question.trueOrder, undefined)
    })
  })
})
