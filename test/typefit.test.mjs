// Fitting a question onto a phone.
//
// The failure this guards against is not a crash: it is a question running off
// the bottom of the screen at somebody's party, with eight people waiting to
// answer it. The host can write their own questions of any length, so this has
// to hold for text nobody has ever seen.
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questionFit, SMALLEST_QUESTION_PX, QUESTION_BANDS } from '../src/typeFit.js'
import { QUESTION_BANK } from '../src/questionBank.js'

// Pull the smallest px out of a `clamp(min, pref, max)` string.
function minPx(fit) {
  const match = /clamp\((\d+(?:\.\d+)?)px/.exec(fit.fontSize)
  assert.ok(match, 'font size is not a clamp: ' + fit.fontSize)
  return Number(match[1])
}
function maxPx(fit) {
  const match = /,\s*(\d+(?:\.\d+)?)px\)/.exec(fit.fontSize)
  assert.ok(match, 'font size has no ceiling: ' + fit.fontSize)
  return Number(match[1])
}

const short = 'What is their go-to coffee order?'
const long =
  'Think back to the last time everybody was together in one room, and describe as ' +
  'precisely as you can the exact moment at which they decided they had had enough ' +
  'of the evening and quietly began planning their exit.'

// --- The property that matters ---------------------------------------------

test('a longer question never gets bigger type than a shorter one', () => {
  const lengths = [5, 30, 72, 73, 108, 109, 130, 131, 200, 201, 400, 2000]
  let previousMax = Infinity
  let previousMin = Infinity

  lengths.forEach((length) => {
    const fit = questionFit('x'.repeat(length))
    assert.ok(
      maxPx(fit) <= previousMax,
      `length ${length} got a bigger ceiling than the length before it`,
    )
    assert.ok(minPx(fit) <= previousMin, `length ${length} got a bigger floor than the one before`)
    previousMax = maxPx(fit)
    previousMin = minPx(fit)
  })
})

test('however long it gets, the type never goes below the floor', () => {
  ;[200, 500, 1000, 5000].forEach((length) => {
    const fit = questionFit('x'.repeat(length))
    assert.ok(
      minPx(fit) >= SMALLEST_QUESTION_PX,
      `a ${length}-character question dropped below the floor`,
    )
  })
})

// Nothing you must read in order to play is ever set below 13px - the design's
// own rule. A question is the thing you most have to read.
test('the floor stays well clear of the design minimum of 13px', () => {
  assert.ok(SMALLEST_QUESTION_PX >= 17)
})

test('the leading opens up as the type shrinks', () => {
  const tight = questionFit(short)
  const loose = questionFit(long)
  assert.ok(
    loose.lineHeight > tight.lineHeight,
    'small type kept the poster leading, which makes many lines unreadable',
  )
  // A poster line-height on two big lines is the point; never go below it.
  assert.ok(tight.lineHeight >= 0.95)
})

// A host can paste anything into their own question. One unbroken run of
// characters must not be able to push the layout sideways.
test('an unbreakable run of characters cannot take the layout sideways', () => {
  const fit = questionFit('x'.repeat(300))
  assert.equal(fit.overflowWrap, 'anywhere')
})

test('a short question still gets the design`s full poster size', () => {
  const fit = questionFit(short)
  assert.equal(maxPx(fit), 40)
  assert.equal(minPx(fit), 28)
})

// --- Nothing silly on the edges --------------------------------------------

test('empty, missing and non-text all fall back to the largest band', () => {
  ;[undefined, null, '', '   ', 42, {}].forEach((value) => {
    const fit = questionFit(value)
    assert.equal(maxPx(fit), 40, 'unexpected size for ' + JSON.stringify(value))
    assert.ok(fit.lineHeight > 0)
  })
})

test('surrounding whitespace does not count towards the length', () => {
  assert.deepEqual(questionFit(short), questionFit('   ' + short + '   '))
})

test('every band is reachable', () => {
  const sizes = new Set()
  ;[10, 90, 120, 160, 400].forEach((length) => {
    sizes.add(questionFit('x'.repeat(length)).fontSize)
  })
  assert.equal(sizes.size, QUESTION_BANDS, 'some band can never be hit')
})

// --- Against the real bank --------------------------------------------------

// The bank runs 29 to 93 characters, median 54, so the overwhelming majority
// should get the full poster size. If this ever fails it means questions are
// creeping longer, which is worth knowing BEFORE they start arriving on screen
// at 33px instead of 40px.
test('nearly all of the written bank gets the full poster size', () => {
  const all = Object.values(QUESTION_BANK).flat()
  const big = all.filter((q) => maxPx(questionFit(q.text)) === 40)
  assert.ok(
    big.length / all.length > 0.85,
    `only ${big.length} of ${all.length} bank questions get the poster size`,
  )
})

// Nothing written should ever come out small. The two lowest bands are for
// host-written questions only.
test('no bank question drops into the two smallest bands', () => {
  Object.entries(QUESTION_BANK).forEach(([type, questions]) => {
    questions.forEach((question) => {
      assert.ok(
        maxPx(questionFit(question.text)) >= 28,
        `${type} has a question long enough to come out small: ${question.text}`,
      )
    })
  })
})
