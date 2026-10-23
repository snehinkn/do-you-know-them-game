// ---------------------------------------------------------------------------
// Small plain functions for working out things from the game object.
// Kept separate from the screens so each screen file stays about what it shows.
//
// STRUCTURE: the game is a list of CATEGORIES (round types). Each category
// holds several questions. Each category has its own internal leaderboard, and
// those points carry straight through to the overall leaderboard as raw points.
// ---------------------------------------------------------------------------

import { roundTypeFor } from './roundTypes.js'
import { applyPowerUps, findCard } from './powerUps.js'

// --- Scoring ---------------------------------------------------------------

// What every answer is ACTUALLY worth to a player's total: the verdict the
// judge gave, with every power-up laid on top, plus the capped stakes and the
// resulting running totals. Returns { effective, stakes, running }, where
// `effective` is { [answerId]: points | null } and null means "not judged
// yet".
//
// This is the single source of truth for points. The overall leaderboard, each
// round's own leaderboard and the "here's how you did" screen all read from it,
// so they can no longer disagree with each other - which they used to, whenever
// a card was played.
//
// Power-ups are applied HERE rather than by rewriting the points the judge
// awarded. Her verdict stays exactly as she gave it, and the cards are laid on
// top every time scores are worked out. That is what makes re-judging safe: a
// card can never double-apply, and removing one cleanly undoes it.
//
// The questions are walked IN PLAY ORDER while a running total is kept, because
// some cards ("the current leader's points are halved") need to know who was
// ahead at that moment in the night, not at the end of it.
//
// WHY STAKES ARE CAPPED HERE RATHER THAN TRUSTED.
//
// The bet slider stops you staking more than you hold, and nothing behind it
// did. The audit staked 999 points for a player holding 4, and she finished
// the night on 1003 against a leader on 21 - the app displayed it as a
// perfectly ordinary result, on every screen, because a number in the database
// was taken at face value.
//
// A stake is now clamped to what that player actually held GOING INTO that
// question, which this walk already knows because it keeps a running total for
// the power-ups. So an inflated bet quietly becomes the largest legal bet
// instead, every device works out the same figure from the same history, and
// nobody has to be trusted for it to come out right.
//
// WHY THE RUNNING TOTAL IS FLOORED AT ZERO AS IT GOES.
//
// It used to be floored only at the very end, which meant a player could carry
// an invisible debt through the night. The second audit found it: somebody on 0
// is hit by Point Thief, their screen still shows 0 (the display has always
// refused to show a negative), and then they answer the next question correctly
// for 2 points and finish on 1 - having silently paid off a point they were
// never told they owed. The comment on `recomputeScores` has always said
// "nobody ever goes negative"; now the running total obeys it too, so what a
// player is shown and what the app is carrying are the same number.
export function effectiveScoring(game) {
  const running = {}
  game.players.forEach((player) => {
    running[player.id] = Math.max(0, player.baseScore || 0)
  })

  // Nobody is ever carrying less than nothing. Called after each question so
  // the next one's stakes, leader and card effects all read the same figure the
  // player can see on their own screen.
  const floorRunning = () => {
    Object.keys(running).forEach((id) => {
      if (running[id] < 0) running[id] = 0
    })
  }

  const effective = {}
  const stakes = {}

  orderedQuestions(game).forEach((question) => {
    const answers = game.answers.filter((a) => a.questionId === question.id)
    const played = (game.powerUps || []).filter((c) => c.used && c.questionId === question.id)

    // Worked out BEFORE this question's points land, because what you were
    // allowed to bet is what you were holding when you bet it.
    answers.forEach((answer) => {
      const asked = answer.wager != null ? answer.wager : answer.bid != null ? answer.bid : 0
      const held = Math.max(0, running[answer.playerId] || 0)
      stakes[answer.id] = Math.max(0, Math.min(asked, held))
    })

    if (answers.length > 0) {
      const raw = {}
      answers.forEach((answer) => {
        raw[answer.id] =
          answer.pointsAwarded === null || answer.pointsAwarded === undefined
            ? null
            : answer.pointsAwarded
      })

      if (played.length === 0) {
        Object.assign(effective, raw)
      } else {
        // Only judged answers take part in the maths; unjudged stay null.
        const judged = {}
        answers.forEach((a) => {
          if (raw[a.id] !== null) judged[a.id] = raw[a.id]
        })

        const answersById = {}
        answers.forEach((a) => {
          answersById[a.id] = a
        })

        // Who is ahead RIGHT NOW, going into this question.
        //
        // Worked out from the SAME list, in the SAME order, as `rankedPlayers`
        // - active players only, in join order, stably sorted by score. It used
        // to sort every player id on the game including anyone who had left,
        // using the unfloored running totals, so "the current leader" could be
        // a different person here than the one Levelling picked when the card
        // was played (`App.playPowerUp` reads `rankedPlayers`). They agreed
        // almost always and could differ on a tie, which is the kind of thing
        // that produces one baffling round a year.
        const leaderId = leadingPlayerId(game, running)

        const adjusted = applyPowerUps({
          playedCards: played,
          pointsByAnswerId: judged,
          answersById,
          maxPoints: question.points || 1,
          leaderId,
          hasWager: roundTypeFor(question).hasWager,
        })

        answers.forEach((a) => {
          effective[a.id] = raw[a.id] === null ? null : (adjusted[a.id] ?? raw[a.id])
        })
      }

      // Roll this question into the running totals before moving on.
      answers.forEach((answer) => {
        const points = effective[answer.id]
        if (points === null || points === undefined) return
        if (!(answer.playerId in running)) return
        running[answer.playerId] += pointsToScore(game, answer, points, stakes[answer.id])
      })
    }

    // Cards that simply hand points over, rather than bending a question's
    // scoring, land at the moment they were played.
    played.forEach((card) => {
      const definition = findCard(card.key)
      if (!definition) return

      if (definition.instant) {
        if (definition.bonusPoints && card.playerId in running) {
          running[card.playerId] += definition.bonusPoints
        }
        if (card.key === 'pointthief' && card.targetPlayerId) {
          if (card.targetPlayerId in running) running[card.targetPlayerId] -= 1
          if (card.playerId in running) running[card.playerId] += 1
        }
      }

      // Payout cards (Wildcard, Bonus Question, Vote of Confidence) hand over
      // whatever the judge tapped on the reveal screen - `card.awardPoints` is
      // per-play, unlike `definition.bonusPoints` which is the same every time.
      // Nothing lands until she has actually chosen an amount.
      if (definition.payout && card.awardPoints != null && card.playerId in running) {
        running[card.playerId] += card.awardPoints
      }
    })

    // This question is done. Nobody carries a debt into the next one.
    floorRunning()
  })

  // A card that hands points over but is no longer attached to a question the
  // game knows about - its question was removed on the setup screen, which sets
  // the card's `played_on_question_id` to null - would otherwise be dropped by
  // the walk above. It was still played and it still paid out, so it is swept
  // up here rather than silently forgotten.
  const walked = new Set(orderedQuestions(game).map((question) => question.id))
  ;(game.powerUps || []).forEach((card) => {
    if (!card.used || walked.has(card.questionId)) return
    const definition = findCard(card.key)
    if (!definition) return

    if (definition.instant) {
      if (definition.bonusPoints && card.playerId in running) {
        running[card.playerId] += definition.bonusPoints
      }
      if (card.key === 'pointthief' && card.targetPlayerId) {
        if (card.targetPlayerId in running) running[card.targetPlayerId] -= 1
        if (card.playerId in running) running[card.playerId] += 1
      }
    }
    if (definition.payout && card.awardPoints != null && card.playerId in running) {
      running[card.playerId] += card.awardPoints
    }
  })
  floorRunning()

  return { effective, stakes, running }
}

// Who is ahead at some point in the walk. Deliberately reads the SAME list in
// the SAME order as `rankedPlayers` below - active players, join order, stable
// sort by score, highest first - so that "the current leader" means one person
// no matter which part of the app is asking.
function leadingPlayerId(game, scoresById) {
  const contenders = activePlayers(game).filter((player) => player.id in scoresById)
  if (contenders.length === 0) return null

  const sorted = [...contenders].sort(
    (a, b) => (scoresById[b.id] || 0) - (scoresById[a.id] || 0),
  )
  return sorted[0].id
}

// How many points one answer moves a total by. Staked rounds ignore the
// question's own points entirely - you win or lose exactly what you put in.
export function pointsToScore(game, answer, points, cappedStake) {
  const question = findQuestion(game, answer.questionId)
  const roundType = roundTypeFor(question)
  if (!roundType.hasWager) return points

  // `cappedStake` is what the player could actually afford at the time - see
  // `effectiveScoring`. The raw fallback is only for callers outside that walk;
  // every scoring path in the app passes the capped figure.
  const stake =
    cappedStake !== undefined && cappedStake !== null
      ? cappedStake
      : answer.wager || answer.bid || 0
  return points > 0 ? stake : -stake
}

// Every question in the order they are actually played: round by round, and
// then in order inside each round. `game.questions` alone is not enough,
// because its order number restarts inside every round.
function orderedQuestions(game) {
  const ordered = []
  const seen = new Set()

  game.categories.forEach((category) => {
    questionsInCategory(game, category.id).forEach((question) => {
      ordered.push(question)
      seen.add(question.id)
    })
  })

  // Anything whose round is missing still has to be scored rather than dropped.
  game.questions.forEach((question) => {
    if (!seen.has(question.id)) ordered.push(question)
  })

  return ordered
}

// Scores are always rebuilt from scratch: everyone starts at their baseScore
// and every judged answer is added on top. Slightly more work than nudging a
// number up and down, and worth it, because the judge can change their mind about
// any answer as often as she likes and the totals stay correct. No drifting,
// no double-counting.
//
// It also means every device works the score out independently from the same
// data, so two screens can never disagree.
//
// This is now simply the end of `effectiveScoring`'s walk, rather than a second
// pass that added the same things up a second way. It used to be the latter,
// and the two could disagree: the walk floored a total at zero after every
// question while this one floored only at the end, so a player carrying a
// Point Thief debt got a different answer from each. One walk, one answer.
export function recomputeScores(game) {
  const { running } = effectiveScoring(game)

  const players = game.players.map((player) => ({
    ...player,
    // A player with no entry in the walk cannot happen (it is seeded from this
    // same list) but falling back to their own base score is the safe reading.
    score: Math.max(0, running[player.id] ?? player.baseScore ?? 0),
  }))

  return { ...game, players }
}

// --- Questions -------------------------------------------------------------

export function findQuestion(game, questionId) {
  return game.questions.find((q) => q.id === questionId)
}

export function currentQuestion(game) {
  return findQuestion(game, game.currentQuestionId)
}

export function findPlayer(game, playerId) {
  return game.players.find((p) => p.id === playerId)
}

// Everyone still in the game. Someone who leaves is switched off rather than
// deleted, so their old answers stay put and nothing they already scored has
// to be unpicked - they simply stop being counted from here on.
//
// `active !== false` rather than `active === true` on purpose: if the column
// is missing for any reason, everyone counts as playing rather than nobody.
export function activePlayers(game) {
  return game.players.filter((player) => player.active !== false)
}

// A player's badge NUMBER - not their rank, their two-digit file number - is
// simply where they come in the join order, counted live rather than stored.
// Shared by every screen that carries the small status-bar badge chip, so all
// of them agree with the number the lobby first handed out (`LobbyScreen`
// counts the same way, from the same list, for the same reason).
export function badgeNumberFor(game, playerId) {
  const index = activePlayers(game).findIndex((player) => player.id === playerId)
  return index >= 0 ? String(index + 1).padStart(2, '0') : '--'
}

// --- Power-ups --------------------------------------------------------------

// The cards a player is still holding right now.
//
// Stored against a category, but in a Power-Up Quiz a fresh hand is dealt for
// EVERY question and the unused ones are cleared first (see `dealPowerUps`),
// so in practice this is "the card for this question". A loser-support card
// sits in a different deck, is not cleared, and so rides along for the whole
// round as it always has.
export function handFor(game, playerId, categoryId) {
  return (game.powerUps || []).filter(
    (card) => card.playerId === playerId && card.categoryId === categoryId && !card.used,
  )
}

// Cards actually spent on one question, used by the host panel and the reveal.
export function cardsPlayedOn(game, questionId) {
  return (game.powerUps || []).filter((card) => card.used && card.questionId === questionId)
}

// --- Categories ------------------------------------------------------------

export function findCategory(game, categoryId) {
  return game.categories.find((c) => c.id === categoryId)
}

export function currentCategory(game) {
  const question = currentQuestion(game)
  // Before anything has started there is no current question, so fall back to
  // the first round on the roster.
  if (!question) return game.categories[0]
  return findCategory(game, question.categoryId)
}

// Only the categories the host chose to include, in running order. Every
// category on a game is a real, playable round - there is no longer any
// hidden one to filter out.
export function activeCategories(game) {
  return game.categories.filter((category) => category.included !== false)
}

// All questions belonging to one category, in order.
export function questionsInCategory(game, categoryId) {
  return game.questions
    .filter((question) => question.categoryId === categoryId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

// Where we are inside the current category, e.g. "Question 2 of 3".
export function questionPosition(game) {
  const category = currentCategory(game)
  if (!category) return { number: 0, total: 0 }

  const questions = questionsInCategory(game, category.id)
  const index = questions.findIndex((q) => q.id === game.currentQuestionId)
  return { number: index + 1, total: questions.length }
}

// Where we are across the whole night, e.g. "Round 2 of 5".
export function categoryPosition(game) {
  const categories = activeCategories(game)
  const category = currentCategory(game)
  const index = categories.findIndex((c) => category && c.id === category.id)
  return { number: index + 1, total: categories.length }
}

export function isLastQuestionInCategory(game) {
  const position = questionPosition(game)
  return position.number >= position.total
}

export function isLastCategory(game) {
  const position = categoryPosition(game)
  return position.number >= position.total
}

// The next question inside the current category, or undefined if that was the
// last one.
export function nextQuestionInCategory(game) {
  const category = currentCategory(game)
  if (!category) return undefined

  const questions = questionsInCategory(game, category.id)
  const index = questions.findIndex((q) => q.id === game.currentQuestionId)
  return questions[index + 1]
}

// The first question of the category after this one.
export function firstQuestionOfNextCategory(game) {
  const categories = activeCategories(game)
  const category = currentCategory(game)
  const index = categories.findIndex((c) => category && c.id === category.id)
  const next = categories[index + 1]
  if (!next) return undefined

  return questionsInCategory(game, next.id)[0]
}

// --- Answers ---------------------------------------------------------------

export function answersForQuestion(game, questionId) {
  return game.answers.filter((a) => a.questionId === questionId)
}

export function answerFor(game, questionId, playerId) {
  return game.answers.find((a) => a.questionId === questionId && a.playerId === playerId)
}

export function votesForQuestion(game, questionId) {
  return (game.votes || []).filter((v) => v.questionId === questionId)
}

export function voteFor(game, questionId, playerId) {
  return (game.votes || []).find((v) => v.questionId === questionId && v.playerId === playerId)
}

// --- Leaderboards ----------------------------------------------------------

// Shared ranking logic: sort by score, highest first, ties share a rank.
// So 7, 6, 6, 4 gives ranks 1, 2, 2, 4 - not 1, 2, 3, 4.
function withSharedRanks(list) {
  const sorted = [...list].sort((a, b) => b.score - a.score)

  const ranked = []
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const previous = ranked[i - 1]

    let rank
    if (previous && previous.score === entry.score) {
      rank = previous.rank
    } else {
      rank = i + 1
    }
    ranked.push({ ...entry, rank })
  }
  return ranked
}

// The overall leaderboard.
export function rankedPlayers(game) {
  return withSharedRanks(activePlayers(game))
}

// Who Levelling actually hits: the room's leader, unless the leader is the
// one holding the card. Handing the front-runner a card that lets her sit
// herself out on demand is not the point of the card - it exists to knock the
// leader down, not to give her an escape hatch - so it steps down to whoever
// is second when that happens. Ties at the top are read the same way
// `rankedPlayers` reads them everywhere else: first in the sorted list wins.
export function autoLevellingTarget(game, activatorId) {
  const ranked = rankedPlayers(game)
  const leader = ranked[0]
  if (!leader) return null
  return leader.id === activatorId ? ranked[1]?.id || null : leader.id
}

// One category's internal leaderboard: points earned inside that category only.
//
// It reads the SAME effective points as the overall leaderboard, cards and all.
// It used to add up the raw verdicts instead, so a round in which somebody
// played "double your points" showed them gaining 4 on this board while their
// running total went up by 8 - two boards on one screen, disagreeing. It also
// decides who gets the mercy card, so the raw version could hand it to the
// wrong person.
export function categoryLeaderboard(game, categoryId) {
  const questionIds = questionsInCategory(game, categoryId).map((q) => q.id)
  const { effective, stakes } = effectiveScoring(game)

  const entries = activePlayers(game).map((player) => {
    let score = 0

    game.answers.forEach((answer) => {
      if (answer.playerId !== player.id) return
      if (!questionIds.includes(answer.questionId)) return

      const points = effective[answer.id]
      if (points === null || points === undefined) return

      score += pointsToScore(game, answer, points, stakes[answer.id])
    })

    // Cards that simply hand points over count towards the round they were
    // spent in, the same way they count towards the total.
    ;(game.powerUps || []).forEach((card) => {
      if (!card.used || !card.questionId) return
      if (!questionIds.includes(card.questionId)) return

      const definition = findCard(card.key)
      if (!definition) return

      if (definition.instant) {
        if (card.playerId === player.id && definition.bonusPoints) score += definition.bonusPoints
        if (card.key === 'pointthief') {
          if (card.playerId === player.id) score += 1
          if (card.targetPlayerId === player.id) score -= 1
        }
      }

      if (definition.payout && card.awardPoints != null && card.playerId === player.id) {
        score += card.awardPoints
      }
    })

    return { ...player, score }
  })

  return withSharedRanks(entries)
}

// Who came last in a category - used by the loser-support power-up.
// Returns EVERYONE tied for last, not an arbitrary one of them. A low-scoring
// round is exactly when support matters most, so a tie shouldn't skip it.
export function categoryLosers(game, categoryId) {
  const board = categoryLeaderboard(game, categoryId)
  if (board.length === 0) return []

  const lowestScore = board[board.length - 1].score
  const losers = board.filter((entry) => entry.score === lowestScore)

  // If literally everyone tied, nobody lost, so nobody needs propping up.
  if (losers.length === board.length) return []
  return losers
}
