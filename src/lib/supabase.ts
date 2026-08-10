import { createClient } from '@supabase/supabase-js'

// Provisioned via the Vercel Marketplace Supabase integration, connected
// specifically to this project (bernafas, not madrasah-iam — same Vercel
// team, separate projects/resources). Anon key only, safe to ship
// client-side: every table it can reach is behind RLS (see
// supabase/migrations/) scoping rows to auth.uid(), so the anon key alone
// can never read or write another user's data.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — run `vercel env pull .env.local` (Supabase integration must be connected to this project first).',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Session persists across reloads (localStorage-backed by default) so
    // a returning user who already completed the magic-link flow skips
    // straight past AuthScreen without re-entering their email.
    persistSession: true,
    autoRefreshToken: true,
    // Supabase's client reads the #access_token=... fragment the magic
    // link lands on and exchanges it for a session automatically — this
    // must stay true for the email-link flow to complete without any
    // manual token handling on our side.
    detectSessionInUrl: true,
  },
})
