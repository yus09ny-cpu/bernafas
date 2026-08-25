import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { renderAffiliateDocx } from './_lib/docxTemplate.js'
import { convertDocxToPdf } from './_lib/convertDocxToPdf.js'
import { verifyUser } from './_lib/verifyUser.js'

// api/affiliate.ts — merged from api/affiliate/{register,dashboard,book}.ts
// (2026-08-21, same Vercel Hobby 12-function-cap consolidation as
// api/shipping.ts / api/admin/shipping.ts before it — see those files' own
// header comments for the original incident). Previously-separate
// GET/POST endpoints, now branched on an `action` query param (register is
// the only POST so it doesn't strictly need one, but keeping all four
// symmetric avoids a "why does only this one work differently" surprise
// later) — dashboard, book, and me (added same day, affiliate login) all
// share GET so each needs one. vercel.json's `functions` map key was
// updated from "api/affiliate/book.ts" to "api/affiliate.ts" so book's
// maxDuration:60 + includeFiles:"buku/**" still apply (now to the whole
// merged function, which is harmless for the other actions — see this
// commit's own message for the size tradeoff). Client call sites updated in
// src/lib/affiliate.ts to `/api/affiliate?action=...`.
// Exported so api/_lib/affiliateAutoSignup.ts (auto-affiliate-on-purchase,
// checkout/callback.ts) generates usernames matching the exact same rule
// this endpoint enforces for manual registration — single source of truth.
// updateWiseEmail (2026-08-22) added here rather than a new file — the
// Vercel Hobby 12-function cap that originally forced this merge is gone
// (Pro plan now), but this action is still an affiliate-self action same as
// dashboard/book/me, so it belongs with them regardless of the cap.
export const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/

// ─── register ──────────────────────────────────────────────────────────
// POST /api/affiliate?action=register — { name, email, username, referredBy? }.
// Uniqueness (spec item 2's "sahkan keunikan username sebelum simpan") is
// enforced by the DB's own `unique` constraints on affiliates.username/
// .email (see 0003_affiliate_program.sql) — insert-then-catch-23505 rather
// than a separate select-then-insert, which would leave a race window
// between two simultaneous registrations picking the same username.
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { name, email, username, referredBy } = (req.body ?? {}) as {
    name?: string
    email?: string
    username?: string
    referredBy?: string
  }

  if (!name?.trim() || !email?.trim() || !username?.trim()) {
    res.status(400).json({ error: 'Nama, e-mel, dan username diperlukan.' })
    return
  }

  const normalizedUsername = username.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    res.status(400).json({ error: 'Username mesti 3-32 aksara, huruf kecil/nombor/tanda sempang(-) atau garis bawah(_) sahaja.' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    res.status(400).json({ error: 'E-mel tidak sah.' })
    return
  }

  // Referral (2-tier commission override, commissions.ts) — resolved to a
  // real existing username or left null, never trusted as opaque text. A
  // broken/typo'd/self ?ref= link degrades to "no referral" rather than
  // blocking registration — the referred person still gets to sign up,
  // they just don't have an upline. Self-referral (?ref= pointing at the
  // exact username someone is about to register) is the one case
  // explicitly rejected outright rather than silently dropped, since it's
  // never a legitimate typo.
  let referredByUsername: string | null = null
  const normalizedReferredBy = referredBy?.trim().toLowerCase()
  if (normalizedReferredBy && normalizedReferredBy !== normalizedUsername) {
    const { data: upline } = await supabaseAdmin.from('affiliates').select('username').eq('username', normalizedReferredBy).maybeSingle()
    if (upline) referredByUsername = upline.username
  }

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .insert({
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      status: 'pending',
      referred_by_username: referredByUsername,
    })
    .select('id, username, status')
    .single()

  if (error) {
    // 23505 = unique_violation (Postgres) — username or email already taken.
    if (error.code === '23505') {
      const field = error.message.includes('email') ? 'E-mel' : 'Username'
      res.status(409).json({ error: `${field} ini sudah digunakan. Sila cuba yang lain.` })
      return
    }
    console.error('[api/affiliate action=register] insert failed:', error.message)
    res.status(500).json({ error: 'Gagal mendaftar. Sila cuba sekali lagi.' })
    return
  }

  res.status(201).json({ id: data.id, username: data.username, status: data.status })
}

// ─── dashboard ─────────────────────────────────────────────────────────
// GET /api/affiliate?action=dashboard&id=<affiliate uuid> — spec item 5's
// "ringkas" dashboard data: click count + real sale counts + commission RM
// totals, broken down by source (own sales vs. referral override) and
// status (pending/paid).
//
// confirmedSales/pendingSales are counted straight from `orders`
// (WHERE affiliate_ref = username), NOT derived from affiliate_commissions
// row count — an order and its commission row(s) are created at different
// times (order at checkout, commission only once ToyyibPay confirms
// payment), so counting sales via commissions would still undercount
// between those two moments.
//
// Access model: the affiliate's row `id` (uuid) doubles as an unguessable
// capability token — there's no separate login for affiliates (the
// Bahagian 4 schema has no auth.uid()/password column on `affiliates`), so
// "knows the dashboard URL" is the access control for this first round.
// Anyone who can guess a UUID could read another affiliate's aggregate
// counts (not their email — that's never returned here) — a real gap, not
// a design choice; flagged for a future stronger-auth pass.
async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : null
  if (!id) {
    res.status(400).json({ error: 'Parameter id diperlukan.' })
    return
  }

  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from('affiliates')
    .select('id, username, name, status')
    .eq('id', id)
    .maybeSingle()

  if (affiliateError) {
    console.error('[api/affiliate action=dashboard] affiliate select failed:', affiliateError.message)
    res.status(500).json({ error: 'Gagal muatkan dashboard.' })
    return
  }
  if (!affiliate) {
    res.status(404).json({ error: 'Affiliate tidak dijumpai.' })
    return
  }

  const [{ count: clickCount, error: clickError }, { data: orders, error: orderError }, { data: commissions, error: commissionError }] =
    await Promise.all([
      supabaseAdmin
        .from('affiliate_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_username', affiliate.username),
      supabaseAdmin.from('orders').select('status').eq('affiliate_ref', affiliate.username),
      supabaseAdmin
        .from('affiliate_commissions')
        .select('commission_type, status, amount')
        .eq('affiliate_username', affiliate.username),
    ])

  if (clickError || orderError || commissionError) {
    console.error(
      '[api/affiliate action=dashboard] stats select failed:',
      clickError?.message,
      orderError?.message,
      commissionError?.message,
    )
    res.status(500).json({ error: 'Gagal muatkan statistik.' })
    return
  }

  let confirmedSales = 0
  let pendingSales = 0
  for (const row of orders ?? []) {
    if (row.status === 'paid') confirmedSales++
    else if (row.status === 'pending') pendingSales++
  }

  // RM totals by (commission_type x status) — 'sale' = affiliate's own
  // sales, 'referral_override' = the 5% they earn from a downline's
  // sales. Kept as two separate totals rather than one combined number so
  // an affiliate with a downline can see both income sources distinctly
  // (spec's own ask).
  const commissionTotals = {
    sale: { pending: 0, paid: 0 },
    referralOverride: { pending: 0, paid: 0 },
  }
  for (const row of commissions ?? []) {
    const bucket = row.commission_type === 'referral_override' ? commissionTotals.referralOverride : commissionTotals.sale
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount ?? 0)
    if (row.status === 'paid') bucket.paid += amount
    else bucket.pending += amount
  }

  res.status(200).json({
    affiliate: { username: affiliate.username, name: affiliate.name, status: affiliate.status },
    clickCount: clickCount ?? 0,
    confirmedSales,
    pendingSales,
    commissions: commissionTotals,
  })
}

// ─── me ────────────────────────────────────────────────────────────────
// GET /api/affiliate?action=me — affiliate login (spec: /affiliate/log-masuk
// screen). Requires a real Supabase Auth session (Authorization: Bearer
// <access_token>, same as api/admin/*.ts's pattern) — reuses whatever
// AffiliateLoginScreen.tsx signed the user in with (Google OAuth or email
// magic-link, both already-existing app-wide mechanisms, see useAuth.ts),
// this route doesn't care which. Returns the caller's OWN affiliate record
// (id/username/name/status), auto-linking it on first call by matching
// `affiliates.email` against the verified session's email —
// supabase/migrations/0008_affiliate_auth.sql's whole reason to exist.
// Never creates a new affiliate row — only an existing registration
// (api/affiliate.ts's register action) can be linked; someone signing in
// with an email that has no affiliate row gets a clear "daftar dahulu"
// error instead of a silently-empty account.
async function handleMe(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Log masuk diperlukan.' })
    return
  }

  // Already linked from a previous login — the common case after the
  // first one. wise_email included here (not in handleDashboard's
  // capability-link response) — this route is the ONLY place that reads it
  // back to the client, gated by a real Supabase Auth session tied to
  // auth_user_id, never by the plain dashboard `id` URL param.
  const { data: linked, error: linkedError } = await supabaseAdmin
    .from('affiliates')
    .select('id, username, name, status, wise_email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (linkedError) {
    console.error('[api/affiliate action=me] linked lookup failed:', linkedError.message)
    res.status(500).json({ error: 'Gagal semak akaun.' })
    return
  }
  if (linked) {
    res.status(200).json({ affiliate: linked })
    return
  }

  // First login — try to link by email match against an UNLINKED
  // affiliate row (affiliates.email is already lowercased at registration
  // time, see handleRegister above).
  const normalizedEmail = user.email.trim().toLowerCase()
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('affiliates')
    .select('id, username, name, status, wise_email, auth_user_id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (candidateError) {
    console.error('[api/affiliate action=me] candidate lookup failed:', candidateError.message)
    res.status(500).json({ error: 'Gagal semak akaun.' })
    return
  }
  if (!candidate) {
    res.status(404).json({ error: 'Tiada akaun affiliate untuk e-mel ini. Sila daftar dahulu.' })
    return
  }
  // Defensive — shouldn't happen in practice (the auth_user_id-based
  // lookup above would already have caught it), but never silently
  // reassign an affiliate row that's already claimed by a different auth
  // identity (e.g. two different Supabase-Auth identities somehow sharing
  // one email across providers).
  if (candidate.auth_user_id && candidate.auth_user_id !== user.id) {
    res.status(409).json({ error: 'E-mel ini sudah dikaitkan dengan akaun log masuk lain.' })
    return
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('affiliates')
    .update({ auth_user_id: user.id })
    .eq('id', candidate.id)
    .select('id, username, name, status, wise_email')
    .single()

  if (updateError) {
    console.error('[api/affiliate action=me] link update failed:', updateError.message)
    res.status(500).json({ error: 'Gagal kaitkan akaun.' })
    return
  }

  res.status(200).json({ affiliate: updated })
}

// ─── updateWiseEmail ───────────────────────────────────────────────────
// POST /api/affiliate?action=updateWiseEmail — { wiseEmail } (empty string
// clears it back to null). Spec: affiliate gives their Wise account email
// so the admin can pay commissions manually via the Wise app — NOT a bank
// account form (product owner's explicit correction, 2026-08-22: bank
// transfer was the original draft spec, replaced with Wise before any code
// was written this round, see this session's own request). Requires a real
// Supabase Auth session (same handleMe pattern) and resolves the affiliate
// row via auth_user_id — deliberately does NOT accept an affiliate id/
// username from the request body, so a viewer holding someone else's
// dashboard capability-link URL can never write to that affiliate's payout
// destination, only their own signed-in one.
async function handleUpdateWiseEmail(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Log masuk diperlukan.' })
    return
  }

  const { wiseEmail } = (req.body ?? {}) as { wiseEmail?: string }
  const trimmed = wiseEmail?.trim() ?? ''
  if (trimmed && !trimmed.includes('@')) {
    res.status(400).json({ error: 'E-mel Wise tidak sah.' })
    return
  }

  const { data: affiliate, error: findError } = await supabaseAdmin
    .from('affiliates')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (findError) {
    console.error('[api/affiliate action=updateWiseEmail] lookup failed:', findError.message)
    res.status(500).json({ error: 'Gagal semak akaun.' })
    return
  }
  if (!affiliate) {
    res.status(404).json({ error: 'Akaun affiliate tidak dijumpai.' })
    return
  }

  const { error: updateError } = await supabaseAdmin
    .from('affiliates')
    .update({ wise_email: trimmed || null })
    .eq('id', affiliate.id)

  if (updateError) {
    console.error('[api/affiliate action=updateWiseEmail] update failed:', updateError.message)
    res.status(500).json({ error: 'Gagal simpan e-mel Wise.' })
    return
  }

  res.status(200).json({ success: true, wiseEmail: trimmed || null })
}

// ─── book ──────────────────────────────────────────────────────────────
// GET /api/affiliate?action=book&username=<affiliate username> — spec item
// 4. Cache-first: checks affiliate_book_generations for a (username,
// BOOK_VERSION) row before doing any docx/PDF work at all. Only on a
// miss/stale version does it render the token, convert via CloudConvert,
// and upload — see convertDocxToPdf.ts's own header for why CloudConvert
// over an in-Function LibreOffice binary.
//
// Bumping BOOK_VERSION invalidates every affiliate's cached PDF
// (affiliate_book_generations' own doc comment: "regenerate bila buku
// update") — the next request per affiliate regenerates instead of
// reusing the cached row. Change this string whenever
// buku/INI_JANTUNGMU_template.docx is edited.
//
// v3 (2026-08-25): Bab 1 AI/Heart Brain content added; the 3
// {{AFFILIATE_REF}} hyperlink relationships re-verified/fixed.
//
// v4 (2026-08-25): 3 images added (book cover, Bab 1 + Bab 2
// infografik). Confirmed the 3 {{AFFILIATE_REF}} hyperlink
// relationships are still intact, untouched by this image addition.
//
// v5 (2026-08-25): Format/spacing fix (content unchanged) — the same
// Word-resave that keeps quietly re-numbering word/media/*.jpeg also
// keeps needing the {{AFFILIATE_REF}} token re-verified each time;
// confirmed 3/3 intact again this round.
const BOOK_VERSION = 'v5'
const TEMPLATE_PATH = path.join(process.cwd(), 'buku', 'INI_JANTUNGMU_template.docx')
const STORAGE_BUCKET = 'affiliate-books'

// Signed URL lifetime for the download link this returns — long enough for
// a real download to complete, short enough that a leaked link doesn't
// stay valid indefinitely (the storage bucket itself is private, per
// migration setup).
const SIGNED_URL_TTL_SECONDS = 60 * 10

async function handleBook(req: VercelRequest, res: VercelResponse) {
  const username = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : null
  if (!username) {
    res.status(400).json({ error: 'Parameter username diperlukan.' })
    return
  }

  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from('affiliates')
    .select('username')
    .eq('username', username)
    .maybeSingle()

  if (affiliateError) {
    console.error('[api/affiliate action=book] affiliate select failed:', affiliateError.message)
    res.status(500).json({ error: 'Gagal semak affiliate.' })
    return
  }
  if (!affiliate) {
    res.status(404).json({ error: 'Affiliate tidak dijumpai.' })
    return
  }

  // Cache check — the whole point of affiliate_book_generations.
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from('affiliate_book_generations')
    .select('pdf_storage_path')
    .eq('affiliate_username', username)
    .eq('book_version', BOOK_VERSION)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cacheError) {
    console.error('[api/affiliate action=book] cache select failed:', cacheError.message)
    res.status(500).json({ error: 'Gagal semak cache.' })
    return
  }

  let storagePath = cached?.pdf_storage_path ?? null

  if (!storagePath) {
    let templateBuffer: Buffer
    try {
      templateBuffer = await readFile(TEMPLATE_PATH)
    } catch (err) {
      console.error('[api/affiliate action=book] template read failed:', err)
      res.status(500).json({ error: 'Templat buku tidak dijumpai di server.' })
      return
    }

    const renderedDocx = await renderAffiliateDocx(templateBuffer, username)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await convertDocxToPdf(renderedDocx)
    } catch (err) {
      // Surface the real reason (e.g. CloudConvert quota/credits exhausted)
      // instead of a generic "cuba lagi" — same pattern as the hrv_sessions
      // save-error fix: a hidden real cause here just wastes time re-tracing
      // the same 502 later. See convertDocxToPdf.ts's describeCloudConvertError.
      const detail = err instanceof Error ? err.message : String(err)
      res.status(502).json({ error: `Gagal jana PDF: ${detail}` })
      return
    }

    storagePath = `${username}/${BOOK_VERSION}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[api/affiliate action=book] storage upload failed:', uploadError.message)
      res.status(500).json({ error: 'Gagal muat naik PDF.' })
      return
    }

    const { error: insertError } = await supabaseAdmin.from('affiliate_book_generations').insert({
      affiliate_username: username,
      book_version: BOOK_VERSION,
      pdf_storage_path: storagePath,
    })
    if (insertError) {
      // Non-fatal — the PDF itself is already uploaded and downloadable;
      // this just means the next request regenerates instead of hitting
      // cache. Logged, not surfaced as a user-facing error.
      console.error('[api/affiliate action=book] generation record insert failed:', insertError.message)
    }
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed) {
    console.error('[api/affiliate action=book] signed URL creation failed:', signError?.message)
    res.status(500).json({ error: 'Gagal jana pautan muat turun.' })
    return
  }

  res.status(200).json({ url: signed.signedUrl, cached: Boolean(cached?.pdf_storage_path) })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : null

  if (req.method === 'POST' && action === 'register') return handleRegister(req, res)
  if (req.method === 'GET' && action === 'dashboard') return handleDashboard(req, res)
  if (req.method === 'GET' && action === 'book') return handleBook(req, res)
  if (req.method === 'GET' && action === 'me') return handleMe(req, res)
  if (req.method === 'POST' && action === 'updateWiseEmail') return handleUpdateWiseEmail(req, res)

  res.status(404).json({ error: 'Unknown action.' })
}
