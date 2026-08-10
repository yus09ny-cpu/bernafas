// One-off verification: proves the REAL write path works (anon key + a
// genuine user session, going through RLS), not a service-role bypass —
// and separately proves an unauthenticated insert is correctly rejected.
// Deliberately doesn't touch app code; exercises the same
// supabase.from('sessions').insert(...) shape sessionPersistence.ts uses.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    }),
)

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const testEmail = 'bernafas-verify-test@example.com'

const admin = createClient(url, serviceRoleKey) // admin API only, never used for the actual data write below
const anon = createClient(url, anonKey) // exactly what the app uses

// ── 1. Negative path first: unauthenticated insert must be rejected ──────
const { error: anonInsertError } = await anon.from('sessions').insert({
  user_id: '00000000-0000-0000-0000-000000000000',
  started_at: new Date().toISOString(),
  duration_sec: 60,
})
if (!anonInsertError) {
  console.error('[verify] FAILED: unauthenticated insert succeeded — RLS is not enforcing.')
  process.exit(1)
}
console.log('[verify] OK: unauthenticated insert correctly rejected —', anonInsertError.message)

// ── 2. Real authenticated path: a genuine user session, via magic-link token exchange ──
let { data: userList } = await admin.auth.admin.listUsers()
let testUser = userList.users.find(u => u.email === testEmail)
if (!testUser) {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  })
  if (createErr) throw createErr
  testUser = created.user
  console.log('[verify] created test user', testUser.id)
} else {
  console.log('[verify] reusing existing test user', testUser.id)
}

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: testEmail,
})
if (linkErr) throw linkErr

// Exchanges the same token a real magic-link click would carry for an
// actual session — via the anon client, exactly like the browser does.
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
})
if (verifyErr) throw verifyErr
console.log('[verify] OK: exchanged magic-link token for a real session, user', verifyData.user.id)

// Same profiles-row check the on_auth_user_created trigger should have handled automatically.
const { data: profile, error: profileErr } = await anon.from('profiles').select('*').eq('id', verifyData.user.id).maybeSingle()
if (profileErr) throw profileErr
if (!profile) {
  console.error('[verify] FAILED: no profiles row auto-created for the new user — trigger did not fire.')
  process.exit(1)
}
console.log('[verify] OK: profiles row auto-created by trigger:', profile)

// The actual write sessionPersistence.ts performs, shaped exactly the same,
// through the anon client now holding a real user session (RLS-enforced).
const fakeHistory = [
  { t: 0, coherence: 0.4, coherenceAlt: 0.3, bpm: 68, rmssdMs: 22 },
  { t: 3, coherence: 0.5, coherenceAlt: 0.55, bpm: 66, rmssdMs: 28 },
  { t: 6, coherence: 0.6, coherenceAlt: 0.7, bpm: 64, rmssdMs: 35 },
]
const { data: inserted, error: insertErr } = await anon
  .from('sessions')
  .insert({
    user_id: verifyData.user.id,
    started_at: new Date(Date.now() - 6000).toISOString(),
    duration_sec: 6,
    coherence_avg: 0.52,
    achievement_pct: 33,
    avg_bpm: 66,
    low_pct: 33.3,
    medium_pct: 33.3,
    high_pct: 33.3,
    history: fakeHistory.map(h => ({ t: h.t, coherenceAlt: h.coherenceAlt, bpm: h.bpm })),
  })
  .select()
  .single()
if (insertErr) {
  console.error('[verify] FAILED: authenticated insert rejected —', insertErr.message)
  process.exit(1)
}
console.log('[verify] OK: authenticated insert into sessions succeeded, row id', inserted.id)
console.log('[verify] Check the Supabase dashboard (Table Editor > sessions) for this row, and Table Editor > profiles for user', verifyData.user.id, '/ email', testEmail)
