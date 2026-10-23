// Fisher-Yates, over a COPY of whatever list is handed in - the original is
// never reordered, since a shuffle in place would quietly change what every
// other caller holding the same reference sees.
//
// Used anywhere something needs a random order: the power-up deck, a fresh
// question draw, a player's own ranking tiles. One implementation, so a fix
// to how randomness works here can't miss a second or third copy.
export function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
