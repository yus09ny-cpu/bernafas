import type { VercelRequest } from '@vercel/node'
import { supabaseAdmin } from './supabaseAdmin.js'

export interface VerifiedUser {
  id: string
  email: string
}

// The client-side app never talks to api/ routes with cookies (this repo
// has no server-rendered session) — a route that needs to know WHICH
// signed-in user is calling it expects the caller to forward their
// Supabase access_token as `Authorization: Bearer <token>` (from
// supabase.auth.getSession()). supabaseAdmin.auth.getUser(token) verifies
// that token's signature server-side (service-role key, doesn't just trust
// the client) and returns the real auth.users row it belongs to.
//
// Returns null on ANY failure (missing header, malformed token, expired
// session, revoked token) — callers treat null as "not signed in", never
// throw here, so a route can choose whether auth is optional (guest
// checkout, api/checkout/create-bill.ts) or required (api/book/full.ts,
// the app_subscription branch of create-bill.ts).
export async function verifyUser(req: VercelRequest): Promise<VerifiedUser | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null

  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user?.email) return null

  return { id: data.user.id, email: data.user.email }
}
