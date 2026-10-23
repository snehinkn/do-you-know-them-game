// ---------------------------------------------------------------------------
// THE GUEST OF HONOUR
//
// Everything the app needs in order to talk about the person the game is
// about: their name, and the words to refer to them by. Nothing about any
// particular person lives in the code - it lives on the game's row in the
// database, typed in by the host at setup, and this module is the only place
// that turns it into words.
//
// The rule the whole design rests on: PREFER THE NAME OVER A PRONOUN. "{name}
// scores · {name} is never wrong" needs no pronoun at all and works for
// anybody. Pronouns are here for the handful of sentences that genuinely need
// one, not as the default.
//
// The second rule: AVOID THE SUBJECT PRONOUN where a verb follows it. "she
// goes" and "they go" do not agree, and singular "they" is the default here,
// so a sentence built on `{they}` needs `{does}` / `{is}` / `{has}` too. It is
// almost always shorter to reword: "the last thing {name} does before going to
// sleep" beats "before {they} {does} to sleep" in every way.
//
// {does} in particular is a trap even when it agrees. "{they} {does} like it"
// comes out as "she does like it", which is emphatic - a denial being argued
// with - where the original just meant "she likes it". Use the name and an
// ordinary verb: "{name} likes it" needs no agreement and carries no tone.
// ---------------------------------------------------------------------------

// What a game looks like before the host has told us anything. These match the
// column defaults in supabase-schema.sql, so a half-configured game still
// reads as English rather than as a blank.
export const DEFAULT_SUBJECT_NAME = 'the guest of honour'
export const DEFAULT_PRONOUNS = 'they'

// The three sets the host can choose between. `they` is the default because it
// is the one that is never wrong about somebody we have not been told about.
export const PRONOUN_SETS = {
  she: {
    they: 'she',
    them: 'her',
    their: 'her',
    theirs: 'hers',
    themself: 'herself',
    is: 'is',
    was: 'was',
    has: 'has',
    does: 'does',
  },
  he: {
    they: 'he',
    them: 'him',
    their: 'his',
    theirs: 'his',
    themself: 'himself',
    is: 'is',
    was: 'was',
    has: 'has',
    does: 'does',
  },
  they: {
    they: 'they',
    them: 'them',
    their: 'their',
    theirs: 'theirs',
    themself: 'themself',
    // Singular "they" takes the plural verb: they are, they were, they have,
    // they do. Getting this wrong is the single most visible way a generic
    // app can read as broken.
    is: 'are',
    was: 'were',
    has: 'have',
    does: 'do',
  },
}

// The choices offered on the setup screen, in the order they are shown.
export const PRONOUN_CHOICES = [
  { value: 'they', label: 'they / them' },
  { value: 'she', label: 'she / her' },
  { value: 'he', label: 'he / him' },
]

// An unknown or missing value falls back to they/them rather than throwing.
// A missing pronoun setting must never be able to blank a screen mid-party.
export function pronounSet(pronouns) {
  return PRONOUN_SETS[pronouns] || PRONOUN_SETS[DEFAULT_PRONOUNS]
}

// Everything a screen needs, from the game row. Safe on a game that predates
// any of these columns, and safe on no game at all.
export function subjectFrom(game) {
  const name = (game?.subjectName || '').trim() || DEFAULT_SUBJECT_NAME
  const pronouns = game?.subjectPronouns || DEFAULT_PRONOUNS
  return {
    name,
    pronouns,
    ...pronounSet(pronouns),
  }
}

// Turn `{name}` / `{their}` / `{them}` and friends into real words.
//
// A capitalised token gives a capitalised word, so `{Their}` opens a sentence
// and `{their}` sits inside one. `{name}` is inserted as typed - a name is
// already however the host chose to capitalise it.
//
// An unrecognised token is left exactly as it was found. A question that says
// `{favourite}` should look obviously wrong to whoever wrote it, rather than
// quietly vanishing mid-game.
const TOKEN = /\{([A-Za-z]+)\}/g

export function fill(text, subject) {
  if (!text) return text
  return String(text).replace(TOKEN, (whole, token) => {
    const key = token.toLowerCase()
    if (key === 'name') return subject.name

    const word = subject[key]
    if (typeof word !== 'string') return whole

    const wasCapitalised = token[0] === token[0].toUpperCase()
    return wasCapitalised ? word.charAt(0).toUpperCase() + word.slice(1) : word
  })
}

// Fill every piece of text a question carries. Called from `loadFullGame`, on
// every question, on the way out of the database - so everything downstream
// (every screen, the judging, the reveal) just reads `question.text` and never
// learns a token existed.
//
// Filling on the way OUT rather than on the way in is what makes renaming the
// guest of honour work: the rows keep their tokens, so a new name re-reads
// every question already dealt instead of needing them rewritten.
//
// `items` is filled too: a ranking question's five things are usually generic,
// but nothing stops a host's own question from naming the person in them.
export function fillQuestion(question, subject) {
  const filled = { ...question, text: fill(question.text, subject) }
  if (question.topic) filled.topic = fill(question.topic, subject)
  // `items` holds two different shapes now. The Line-Up's are plain strings -
  // the things being ranked - and they get filled as they always have. The
  // Alibi's are the published ballot, `{ id, text }`, and mapping an object
  // through `fill` turns it into the string "[object Object]", which is
  // exactly what it did the first time the ballot went through here.
  if (Array.isArray(question.items)) {
    filled.items = question.items.map((item) =>
      item && typeof item === 'object'
        ? { ...item, text: fill(item.text, subject) }
        : fill(item, subject),
    )
  }
  return filled
}
