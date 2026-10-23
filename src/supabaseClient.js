import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// The one connection to the database. Everything that talks to Supabase goes
// through this file.
//
// The two values come from .env.local, which is never committed to GitHub.
// Vite only exposes variables that start with VITE_, which is why they are
// named the way they are.
// ---------------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// If the keys are missing the app must say so loudly. A silent failure here
// would show up much later as a mysterious blank screen, which is the single
// worst outcome on the night.
export const supabaseConfigError =
  !url || !key
    ? 'The app is not connected to its database. The Supabase settings are missing. ' +
      'If this is the live site, the environment variables need adding in Vercel.'
    : null

export const supabase = supabaseConfigError ? null : createClient(url, key)

// A quick "can we actually reach the database?" check, used on startup so a
// broken connection is visible immediately rather than mid-game.
export async function testConnection() {
  if (!supabase) return { ok: false, message: supabaseConfigError }

  try {
    const { error } = await supabase.from('games').select('id').limit(1)
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: 'Connected' }
  } catch (problem) {
    return { ok: false, message: String(problem) }
  }
}
