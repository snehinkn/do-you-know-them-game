// ---------------------------------------------------------------------------
// The guest of honour, available to any screen without threading a prop
// through five components to reach it.
//
// Most screens already receive `game` and could call `subjectFrom(game)`
// themselves. The reason this exists is the ones that do not - PowerCard is
// handed a card and nothing else, and is rendered from four different places.
// Passing the subject down to it by hand would mean touching every one of
// them, for a string.
//
// This file deliberately exports no components: App.jsx uses
// `<SubjectContext.Provider>` directly. A file that exports both a component
// and a hook breaks fast refresh, which is the one lint warning this project
// already has and does not need a second of.
// ---------------------------------------------------------------------------
import { createContext, useContext } from 'react'
import { subjectFrom, fill } from './subject.js'

// The default is a real subject, not null - so a component rendered outside
// the provider (a loading screen, an error boundary) still reads as English
// rather than crashing on a missing context.
export const SubjectContext = createContext(subjectFrom(null))

export function useSubject() {
  return useContext(SubjectContext)
}

// `say` turns a token string into words: say('{name} scores') -> 'Priya scores'.
// Named for how it reads at the call site, which is almost always inside JSX.
export function useSay() {
  const subject = useSubject()
  return (text) => fill(text, subject)
}
