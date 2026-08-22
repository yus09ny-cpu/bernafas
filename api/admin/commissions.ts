import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'

// GET/POST /api/admin/commissions — /admin/komisen's backend. 'super'
// minimum (not 'admin') — this touches an affiliate's Wise payout e-mel,
// which supabase/migrations/0007_admin_roles.sql's own header names as
// exactly the kind of thing 'super' (not the shipping-only 'admin' floor)
// is for: "product/order/affiliate management".
//
// GET  (no params)          → every affiliate with an outstanding pending
//                              total > 0, highest first (spec item 1 — "yang
//                              paling perlu diuruskan").
// GET  ?username=<username> → one affiliate's Wise e-mel + every commission
//                              row they have (any status), newest first.
// POST                      → mark row(s) 'paid' + stamp paid_at. Body is
//                              EITHER { ids: string[] } (specific rows,
//                              spec item 3's "pilih baris individu") OR
//                              { username: string } (ALL of that affiliate's
//                              currently-pending rows in one go, spec item
//                              3's "semua baris pending...sekali gus"). Both
//                              branches filter .eq('status', 'pending') on
//                              the update itself, so an already-'paid' row
//                              can never be touched twice (idempotent,
//                              matches commissions.ts's own reasoning
//                              elsewhere in this repo).

interface AffiliatePendingTotal {
  username: string
  name: string
  pendingTotal: number
}

async function handleListPending(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('affiliate_username, amount, affiliates(name)')
    .eq('status', 'pending')

  if (error) {
    console.error('[api/admin/commissions GET list] query failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan senarai komisen.' })
    return
  }

  // Aggregated in JS, not SQL — same style as api/affiliate.ts's
  // handleDashboard (small row counts, not worth a separate RPC/view).
  const totals = new Map<string, AffiliatePendingTotal>()
  for (const row of data ?? []) {
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount ?? 0)
    const affiliateRelation = row.affiliates as unknown as { name: string } | { name: string }[] | null
    const name = Array.isArray(affiliateRelation) ? affiliateRelation[0]?.name : affiliateRelation?.name
    const existing = totals.get(row.affiliate_username)
    if (existing) existing.pendingTotal += amount
    else totals.set(row.affiliate_username, { username: row.affiliate_username, name: name ?? row.affiliate_username, pendingTotal: amount })
  }

  const list = [...totals.values()].sort((a, b) => b.pendingTotal - a.pendingTotal)
  res.status(200).json({ affiliates: list })
}

async function handleDetail(username: string, res: VercelResponse) {
  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from('affiliates')
    .select('username, name, wise_email')
    .eq('username', username)
    .maybeSingle()

  if (affiliateError) {
    console.error('[api/admin/commissions GET detail] affiliate select failed:', affiliateError.message)
    res.status(500).json({ error: 'Gagal muatkan affiliate.' })
    return
  }
  if (!affiliate) {
    res.status(404).json({ error: 'Affiliate tidak dijumpai.' })
    return
  }

  const { data: commissions, error: commissionError } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('id, order_id, amount, status, commission_type, created_at, paid_at, orders(created_at, amount, product_type)')
    .eq('affiliate_username', username)
    .order('created_at', { ascending: false })

  if (commissionError) {
    console.error('[api/admin/commissions GET detail] commissions select failed:', commissionError.message)
    res.status(500).json({ error: 'Gagal muatkan baris komisen.' })
    return
  }

  res.status(200).json({ affiliate, commissions: commissions ?? [] })
}

async function handleMarkPaid(req: VercelRequest, res: VercelResponse) {
  const { ids, username } = (req.body ?? {}) as { ids?: string[]; username?: string }
  const paidAt = new Date().toISOString()

  if (Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabaseAdmin
      .from('affiliate_commissions')
      .update({ status: 'paid', paid_at: paidAt })
      .in('id', ids)
      .eq('status', 'pending')

    if (error) {
      console.error('[api/admin/commissions POST ids] update failed:', error.message)
      res.status(500).json({ error: 'Gagal tandakan dibayar.' })
      return
    }
    res.status(200).json({ success: true })
    return
  }

  if (typeof username === 'string' && username.trim()) {
    const { error } = await supabaseAdmin
      .from('affiliate_commissions')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('affiliate_username', username.trim().toLowerCase())
      .eq('status', 'pending')

    if (error) {
      console.error('[api/admin/commissions POST username] update failed:', error.message)
      res.status(500).json({ error: 'Gagal tandakan dibayar.' })
      return
    }
    res.status(200).json({ success: true })
    return
  }

  res.status(400).json({ error: 'ids atau username diperlukan.' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  if (!(await hasAdminRole(user, 'super'))) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

  if (req.method === 'GET') {
    const username = typeof req.query.username === 'string' ? req.query.username : null
    if (username) return handleDetail(username, res)
    return handleListPending(res)
  }
  if (req.method === 'POST') return handleMarkPaid(req, res)
  res.status(405).json({ error: 'Method not allowed' })
}
