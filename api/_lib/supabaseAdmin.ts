import { createClient } from '@supabase/supabase-js'

// Service-role client, server-side only (api/ routes never ship to the
// browser bundle — this file must never be imported from src/). Bypasses
// RLS by design; that's deliberate here, not an oversight — affiliates/
// affiliate_book_generations/affiliate_commissions/affiliate_commission_rates
// carry no auth.uid() ownership column to scope an anon RLS policy against
// (see supabase/migrations/0003_affiliate_program.sql's header comment), so
// every read/write to those four goes through routes in this api/ folder
// using this client, never raw client-side supabase-js calls.
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set these in the Vercel project\'s environment variables (Production + Preview).')
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
