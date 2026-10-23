// ---------------------------------------------------------------------------
// ROUND TYPES - the heart of the game's variety.
//
// The important idea (and the thing that keeps the code small): a round is
// three separate decisions bolted together.
//
//   inputType  - what the PLAYER does   (type text, type a number, drag to rank)
//   judgeMode  - what THE HOST does     (score each / nothing / pick a winner)
//   scoring    - how points are worked out afterwards
//
// Keeping those apart means a new round is usually a small config entry rather
// than a new screen, and it means the judge's workload is deliberately different
// in every round instead of "score eight answers, eight times a night".
//
// A round type is a CATEGORY. Each category holds several questions and has its
// own internal leaderboard, which feeds the overall one as raw points.
// ---------------------------------------------------------------------------

// The ways the guest of honour can be involved in scoring a round.
//
//   score_each  She reads anonymised answers and taps a points button on each.
//               The only mode where her effort grows with the player count.
//
//   auto        She does nothing except answer as a player. Her own answer is
//               the key, and the app works out everyone's points from it.
//
//   auto_match  Same idea, for orderings rather than single values.
//
//   pick_winner She reads the entries and crowns one favourite.
//
//   none        Fully automatic from what the PLAYERS did. She just watches.
//
// ---------------------------------------------------------------------------
// VERDICTS
//
// The judge picks one of three, and the points follow automatically. They never
// types a number. Letting her choose freely meant the same quality of answer
// could be worth different amounts depending on the moment, which is unfair on
// whoever got judged last.
//
// The scale is FIXED across every judged question, so no question is quietly
// worth more than another.
// ---------------------------------------------------------------------------
export const VERDICTS = {
  CORRECT: 'correct',
  PARTIAL: 'partial',
  WRONG: 'wrong',
}

export const VERDICT_POINTS = {
  [VERDICTS.CORRECT]: 2,
  [VERDICTS.PARTIAL]: 1,
  [VERDICTS.WRONG]: 0,
}

export const VERDICT_LABELS = {
  [VERDICTS.CORRECT]: '{Name} approves',
  [VERDICTS.PARTIAL]: 'Half right',
  [VERDICTS.WRONG]: 'Absolutely not',
}

// Points are stored as the number, so the verdict is read back out of it.
export function verdictFromPoints(points) {
  if (points === null || points === undefined) return null
  if (points >= VERDICT_POINTS[VERDICTS.CORRECT]) return VERDICTS.CORRECT
  if (points >= VERDICT_POINTS[VERDICTS.PARTIAL]) return VERDICTS.PARTIAL
  return VERDICTS.WRONG
}

// Which verdicts a round offers. Staked rounds have no middle ground: you
// either win your bet or you lose it, so "half right" makes no sense there.
export function verdictsFor(roundType) {
  if (roundType && roundType.hasWager) return [VERDICTS.CORRECT, VERDICTS.WRONG]
  return [VERDICTS.CORRECT, VERDICTS.PARTIAL, VERDICTS.WRONG]
}

export const JUDGE_MODES = {
  SCORE_EACH: 'score_each',
  AUTO: 'auto',
  AUTO_MATCH: 'auto_match',
  PICK_WINNER: 'pick_winner',
  NONE: 'none',
}

export const ROUND_TYPES = {
  typed: {
    key: 'typed',
    label: 'The Canvass',
    blurb: 'Everyone types an answer. {name} scores each one.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.SCORE_EACH,
    hostHint: 'You read each answer and give it points. Names are hidden by default.',
  },

  number: {
    key: 'number',
    label: 'The Estimate',
    blurb: 'A number question. {name} answers too, and closest to {them} wins.',
    inputType: 'number',
    judgeMode: JUDGE_MODES.AUTO,
    // She answers live rather than pre-writing the number. Same scoring either
    // way, but it needs no prep and it lets us ask opinion questions that have
    // no external right answer.
    hostAnswers: true,
    hostHint: 'Give your own answer first. Closest guesses to yours take the points.',
  },

  // NOTE: the redesign bundle also uses "the line-up" for a different screen
  // (the Alibi's vote step) in its own prose. Same words, unrelated meaning -
  // this is the round's TITLE, not that screen.
  rank: {
    key: 'rank',
    label: 'The Line-Up',
    blurb: 'Put five things in order. {name} ranks too, and players match to {them}.',
    inputType: 'rank',
    judgeMode: JUDGE_MODES.AUTO_MATCH,
    hostAnswers: true,
    hostHint: 'You build your own order while they build theirs. Then the app matches them to you.',
  },

  pitch: {
    key: 'pitch',
    label: 'The Cover Story',
    blurb: 'A tall story to sell. {name} just picks {their} favourite.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.PICK_WINNER,
    maxLength: 200,
    hostHint: 'Read them out, then crown one winner. No scoring each entry.',
  },

  fib: {
    key: 'fib',
    label: 'The Alibi',
    blurb: 'Everyone writes a lie. Players guess which answer is really true.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.NONE,
    // Two phases: write lies, then everyone votes on which is true.
    needsVoting: true,
    // She writes the true answer live, at the same moment everyone else is
    // writing their lies. Neither side sees the other, so it works exactly like
    // pre-writing it - with no prep, and no answer key to keep track of.
    hostAnswers: true,
    hostHint: 'Write the true answer while they write their lies. Yours gets shuffled in.',
  },

  auction: {
    key: 'auction',
    label: 'The Payoff',
    blurb: 'Players bid points for the exclusive right to answer.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.SCORE_EACH,
    // Bidding happens first; only the winning bidder gets to answer.
    needsBidding: true,
    hasWager: true,
    hostHint: 'Only the winning bidder answers. They win or lose exactly what they bid.',
  },

  powerup: {
    key: 'powerup',
    label: 'The Leverage',
    blurb: 'Typed answers, but players can spend a power-up first.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.SCORE_EACH,
    hasPowerUps: true,
    hostHint: 'Score answers as normal. The app applies power-up effects for you.',
  },

  wager: {
    key: 'wager',
    label: 'The Last Word',
    blurb: 'Players bet their own points before seeing the question.',
    inputType: 'text',
    judgeMode: JUDGE_MODES.SCORE_EACH,
    hasWager: true,
    hostHint: 'Score answers as normal. The app handles all the betting maths.',
  },
}

// Look up a round type safely. Falls back to plain typed answers rather than
// crashing, because a missing type must never blank the screen mid-party.
export function roundTypeFor(question) {
  if (!question) return ROUND_TYPES.typed
  return ROUND_TYPES[question.type] || ROUND_TYPES.typed
}

// ---------------------------------------------------------------------------
// SCORING RULES
// Each is a plain function taking the question and the answers for it, and
// returning { [answerId]: points }. No side effects, easy to reason about.
// ---------------------------------------------------------------------------

// CLOSEST GUESS - tiered by proximity to the guest of honour's own answer.
// Tiers keep more
// people invested than winner-takes-all. Exact ties both get the full tier
// amount (faster on the night than splitting, and nobody argues with more).
export function scoreClosestGuess(question, answers) {
  const TIER_POINTS = [3, 2, 1]
  const result = {}
  const target = question.trueNumber

  answers.forEach((answer) => {
    result[answer.id] = 0
  })
  if (target === null || target === undefined) return result

  const guesses = answers
    .filter((answer) => typeof answer.number === 'number' && !Number.isNaN(answer.number))
    .map((answer) => ({ answerId: answer.id, distance: Math.abs(answer.number - target) }))

  if (guesses.length === 0) return result

  // Group by distance so equally-close guesses share a tier.
  const distances = [...new Set(guesses.map((g) => g.distance))].sort((a, b) => a - b)

  distances.slice(0, TIER_POINTS.length).forEach((distance, tierIndex) => {
    guesses
      .filter((g) => g.distance === distance)
      .forEach((g) => {
        result[g.answerId] = TIER_POINTS[tierIndex]
      })
  })

  return result
}

// RANK THEIR FAVOURITES - positional distance against the guest of honour's
// own order.
// 2 points for an item in exactly the right place, 1 for being one place off.
// Generous partial credit produces near-ties, which is good for tension.
export function scoreRanking(question, answers, trueOrder) {
  const result = {}
  if (!trueOrder || trueOrder.length === 0) {
    answers.forEach((answer) => {
      result[answer.id] = 0
    })
    return result
  }

  answers.forEach((answer) => {
    const playerOrder = answer.order || []
    let total = 0

    trueOrder.forEach((item, correctIndex) => {
      const playerIndex = playerOrder.indexOf(item)
      if (playerIndex === -1) return

      const distance = Math.abs(playerIndex - correctIndex)
      if (distance === 0) total += 2
      else if (distance === 1) total += 1
    })

    result[answer.id] = total
  })

  return result
}

// FIBBAGE FLIP - you score two ways, which is what makes the round work:
//   +1 for every player your lie fooled
//   +2 for spotting the real answer yourself
export const FIB_POINTS_PER_FOOL = 1
export const FIB_POINTS_FOR_TRUTH = 2

// `voteMap` translates a published ballot id back into what it really was -
// see `publishVoteOptions`. Older votes were cast against answer ids directly,
// so a missing map means "the ids are already the real ones".
export function scoreFibbage(answers, votes, voteMap = null) {
  const result = {}
  answers.forEach((answer) => {
    result[answer.id] = 0
  })

  const resolve = (choiceId) => (voteMap && voteMap[choiceId] ? voteMap[choiceId] : choiceId)

  votes.forEach((vote) => {
    const choice = resolve(vote.choiceId)

    if (choice === TRUTH_OPTION_ID) {
      // This player found the real answer. Credit it to their own entry.
      const theirAnswer = answers.find((a) => a.playerId === vote.playerId)
      if (theirAnswer) result[theirAnswer.id] += FIB_POINTS_FOR_TRUTH
      return
    }

    if (result[choice] === undefined) return

    // YOU CANNOT FOOL YOURSELF. The voting screen greys out your own lie, but
    // greying out a button is a courtesy, not a rule - the audit sent the vote
    // anyway and it scored, and the reveal screen then printed "Fooled Dez,
    // Tomas" against Dez's own entry. The rule belongs here, where the points
    // are actually worked out, rather than on the button.
    const lie = answers.find((a) => a.id === choice)
    if (lie && lie.playerId === vote.playerId) return

    // They fell for someone's lie. Credit the liar.
    result[choice] += FIB_POINTS_PER_FOOL
  })

  return result
}

// The real answer is shown alongside the lies under this fixed id.
export const TRUTH_OPTION_ID = 'truth'

// Two pieces of text are the same statement if they are the same words - a
// stray capital or a trailing space is not a different answer.
const sameStatement = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase()

// Builds the shuffled list of options for a Fibbage vote: every player's lie
// plus the real answer, in a stable random order.
//
// A LIE THAT IS ACTUALLY THE TRUTH does not get its own option. Somebody
// occasionally writes the real answer while trying to invent one - in this game
// that is the funniest thing that can happen - and listing it twice produced a
// ballot with two identical lines and, worse, locked its author out of the
// round: the voting screen marks an option "yours" by matching the words, so
// BOTH copies came up greyed out and the one person who had definitely got it
// right could not vote for it. Watched happening in the second audit, and the
// player was then told "YOU FELL FOR A LIE".
//
// So the truth absorbs it. There is one option, it is the real answer, and its
// author can vote for it like anybody else. They cannot earn fooling points
// with it, which is correct - you cannot fool anyone with the truth.
export function fibbageOptions(question, answers) {
  const options = answers
    .filter((answer) => !sameStatement(answer.text, question.trueAnswer))
    .map((answer) => ({
      id: answer.id,
      text: answer.text,
      authorId: answer.playerId,
    }))
  options.push({ id: TRUTH_OPTION_ID, text: question.trueAnswer, authorId: null })

  // Sort by a hash of the id so the order is random-looking but does not
  // reshuffle on every render, which would be maddening to click.
  return options.sort((a, b) => hashString(a.id + question.id) - hashString(b.id + question.id))
}

function hashString(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000
  }
  return hash
}

// ---------------------------------------------------------------------------
// THE ALIBI'S BALLOT, AND WHY IT IS PUBLISHED RATHER THAN BUILT ON EACH PHONE
//
// Every other round can simply withhold the answer from players until the
// reveal. This one cannot: the true answer has to be ON the player's screen
// during the vote, because it is one of the things they are choosing between.
//
// It used to be assembled on each device from `question.trueAnswer`, and the
// truth carried the fixed id `'truth'` - so the answer, and which option it
// was, were both sitting in every player's browser during the vote. That is
// the whole round, given away.
//
// So the host publishes the ballot ONCE, when the vote opens. Every option -
// truth and lies alike - is relabelled with a fresh random id that matches
// nothing the player holds, and the list of which id was which goes in with
// the answer key, where players cannot reach it until the reveal. What a
// player receives is four texts and four meaningless ids.
//
// `fibbageOptions` above still does the shuffling, so the fairness test that
// covers it still covers the order these are published in.
// ---------------------------------------------------------------------------

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'o' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Takes the shuffled options and returns the two halves: the public ballot,
// and the key that says what each id really was.
export function publishVoteOptions(orderedOptions) {
  const ballot = []
  const voteMap = {}

  orderedOptions.forEach((option) => {
    const id = randomId()
    ballot.push({ id, text: option.text })
    // `'truth'` for the real answer, otherwise the answer row that wrote it.
    voteMap[id] = option.id === TRUTH_OPTION_ID ? TRUTH_OPTION_ID : option.id
  })

  return { ballot, voteMap }
}

// The ballot as the voting screen should draw it. Falls back to building it
// the old way for a question whose vote opened before this existed, so a game
// already in flight when this shipped does not lose its round.
export function ballotFor(question, answers) {
  const published = question && Array.isArray(question.items) ? question.items : null
  if (published && published.length > 0 && published.every((o) => o && o.id && 'text' in o)) {
    return published
  }
  return fibbageOptions(question, answers)
}

// Which ballot id was the real answer, for the screens that may say so.
// Returns null while the reader is not entitled to know - which is exactly
// what a player holds mid-vote.
export function truthOptionIdFrom(voteMap) {
  if (!voteMap) return null
  const found = Object.keys(voteMap).find((id) => voteMap[id] === TRUTH_OPTION_ID)
  return found || null
}

// The answer key for a published ballot, or null if there isn't one.
export function voteMapFor(question) {
  const order = question && question.trueOrder
  if (order && !Array.isArray(order) && order.voteMap) return order.voteMap
  return null
}

// THE AUCTION - work out who won the bidding. Highest bid takes it; ties mean
// everyone tied gets to answer, and each wins or loses their own bid.
export function auctionWinners(answers) {
  const bids = answers.filter((answer) => typeof answer.bid === 'number' && answer.bid > 0)
  if (bids.length === 0) return []

  const topBid = Math.max(...bids.map((answer) => answer.bid))
  return bids.filter((answer) => answer.bid === topBid)
}

