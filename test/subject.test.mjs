// Naming the guest of honour.
//
// This is the whole of Phase 1 in one module: the questions are written about
// `{name}`, and this is what turns a token into a person. Getting it wrong
// does not crash anything - it puts a literal `{name}` on a screen in front of
// eight people, or says "they is never wrong". Both are pinned here.
//
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fill,
  fillQuestion,
  subjectFrom,
  pronounSet,
  DEFAULT_SUBJECT_NAME,
  PRONOUN_CHOICES,
} from '../src/subject.js'
import { QUESTION_BANK } from '../src/questionBank.js'

const priya = subjectFrom({ subjectName: 'Priya', subjectPronouns: 'she' })
const sam = subjectFrom({ subjectName: 'Sam', subjectPronouns: 'they' })

test('the name goes in wherever {name} appears', () => {
  assert.equal(fill("What is {name}'s go-to coffee order?", priya), "What is Priya's go-to coffee order?")
  assert.equal(fill('{name} scores · {name} is never wrong', priya), 'Priya scores · Priya is never wrong')
})

test('possessive and object pronouns follow the chosen set', () => {
  assert.equal(fill('in {their} own words', priya), 'in her own words')
  assert.equal(fill('in {their} own words', sam), 'in their own words')
  assert.equal(fill('pay someone to do it for {them}', priya), 'pay someone to do it for her')
  assert.equal(fill('pay someone to do it for {them}', sam), 'pay someone to do it for them')
})

// The one that actually bites. Singular "they" takes the plural verb, so a
// naive pronoun swap produces "they is never wrong" - which is the single most
// visible way a generic app can read as broken.
test('verbs agree with singular they', () => {
  assert.equal(fill('{they} {is} never wrong', priya), 'she is never wrong')
  assert.equal(fill('{they} {is} never wrong', sam), 'they are never wrong')
  assert.equal(fill('{they} {has} decided', sam), 'they have decided')
  assert.equal(fill('{they} {does} believe it', sam), 'they do believe it')
  assert.equal(fill('{they} {was} right', sam), 'they were right')
  assert.equal(fill('{they} {does} believe it', subjectFrom({ subjectPronouns: 'he' })), 'he does believe it')
})

test('a capitalised token gives a capitalised word', () => {
  assert.equal(fill('{Their} opinion is not', priya), 'Her opinion is not')
  assert.equal(fill('{They} {is} going to bed', sam), 'They are going to bed')
  // The name is inserted exactly as the host typed it, never re-capitalised.
  assert.equal(fill('{name}', subjectFrom({ subjectName: 'de Souza' })), 'de Souza')
})

// A token nobody defined should look obviously wrong to whoever wrote it,
// rather than quietly disappearing mid-game.
test('an unknown token is left alone rather than blanked', () => {
  assert.equal(fill('{favourite} thing', priya), '{favourite} thing')
})

test('a game with nothing filled in still reads as English', () => {
  const nobody = subjectFrom(null)
  assert.equal(nobody.name, DEFAULT_SUBJECT_NAME)
  assert.equal(fill('{they} {is} never wrong', nobody), 'they are never wrong')
  assert.equal(fill('Ask {name} for a hint', nobody), 'Ask the guest of honour for a hint')

  // A blank or whitespace name is "not said yet", not a name.
  assert.equal(subjectFrom({ subjectName: '   ' }).name, DEFAULT_SUBJECT_NAME)
})

test('an unrecognised pronoun setting falls back to they rather than crashing', () => {
  assert.equal(pronounSet('martian').they, 'they')
  assert.equal(subjectFrom({ subjectPronouns: 'martian' }).is, 'are')
})

test('every pronoun choice offered on the setup screen actually exists', () => {
  PRONOUN_CHOICES.forEach((choice) => {
    assert.ok(pronounSet(choice.value).they, choice.value + ' has no pronoun set')
    // Not the fallback by accident - each choice must be its own entry.
    assert.equal(pronounSet(choice.value).they, choice.value === 'she' ? 'she' : choice.value === 'he' ? 'he' : 'they')
  })
})

test('fillQuestion fills the text, the topic and the ranking items', () => {
  const filled = fillQuestion(
    {
      text: "What is {name}'s phone wallpaper?",
      topic: '{Their} phone',
      items: ['{name} at work', 'Something generic'],
      points: 3,
    },
    priya,
  )
  assert.equal(filled.text, "What is Priya's phone wallpaper?")
  assert.equal(filled.topic, 'Her phone')
  assert.deepEqual(filled.items, ['Priya at work', 'Something generic'])
  // Everything else survives untouched.
  assert.equal(filled.points, 3)
})

test('fillQuestion does not mutate the bank entry it was given', () => {
  const original = { text: 'Ask {name}', items: ['{name}'] }
  fillQuestion(original, priya)
  assert.equal(original.text, 'Ask {name}')
  assert.deepEqual(original.items, ['{name}'])
})

// The whole point of the exercise: no question may name a particular person,
// and none may carry a token this module cannot fill.
test('no question in the bank names anybody, and every token is fillable', () => {
  const known = new Set(Object.keys(sam).concat('name'))

  Object.entries(QUESTION_BANK).forEach(([type, questions]) => {
    questions.forEach((question) => {
      const parts = [question.text, question.topic || '', ...(question.items || [])]
      parts.forEach((part) => {
        assert.ok(!/\b(Priya|Sam|Alex|Jordan)\b/i.test(part), type + ' still names somebody: ' + part)

        for (const [, token] of part.matchAll(/\{([A-Za-z]+)\}/g)) {
          assert.ok(known.has(token.toLowerCase()), type + ' uses an unknown token {' + token + '}: ' + part)
        }
      })
    })
  })
})

// Reworded rather than swapped: a subject pronoun in front of an ordinary verb
// is the one construction the token set cannot rescue.
test('no question puts {they} in front of a verb without agreement', () => {
  Object.entries(QUESTION_BANK).forEach(([type, questions]) => {
    questions.forEach((question) => {
      const filled = fillQuestion(question, sam)
      const parts = [filled.text, filled.topic || '', ...(filled.items || [])]
      parts.forEach((part) => {
        assert.ok(
          !/\bthey (is|was|has|does|goes|wants|says|likes|knows|thinks)\b/i.test(part),
          type + ' reads wrong for they/them: ' + part,
        )
      })
    })
  })
})
