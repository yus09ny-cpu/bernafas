import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

// GET /api/affiliate/dashboard?id=<affiliate uuid> — spec item 5's "ringkas"
// dashboard data: click count + real sale counts + commission RM totals,
// broken down by source (own sales vs. referral override) and status
// (pending/paid). Rate decision has landed (see api/_lib/commissions.ts),
// so RM amounts are real now — no longer withheld pending a rate decision.
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
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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
    console.error('[api/affiliate/dashboard] affiliate select failed:', affiliateError.message)
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
      '[api/affiliate/dashboard] stats select failed:',
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
