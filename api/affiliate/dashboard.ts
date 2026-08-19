import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin'

// GET /api/affiliate/dashboard?id=<affiliate uuid> — spec item 5's "ringkas"
// dashboard data: click count + real sale counts, NO ringgit amounts
// (affiliate_commission_rates.rate_value is unset — see the migration's
// header comment — so any amount shown here would be fabricated/misleading;
// deliberately not summed).
//
// confirmedSales/pendingSales are counted straight from `orders`
// (WHERE affiliate_ref = username), NOT from affiliate_commissions —
// commission rows don't exist yet (no code creates them, on purpose, until
// a rate is set), so counting from that table always read 0 even after a
// real, paid sale came through. An affiliate seeing "0 Jualan" after
// actually selling a copy reads as "the tracking is broken," which it
// isn't — the sale itself was always captured in `orders.affiliate_ref`
// (see api/checkout/create-bill.ts); only the commission AMOUNT is
// pending on the rate decision. Counting orders directly fixes the
// confusing number without needing that decision first.
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

  const [{ count: clickCount, error: clickError }, { data: orders, error: orderError }] = await Promise.all([
    supabaseAdmin
      .from('affiliate_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_username', affiliate.username),
    supabaseAdmin
      .from('orders')
      .select('status')
      .eq('affiliate_ref', affiliate.username),
  ])

  if (clickError || orderError) {
    console.error('[api/affiliate/dashboard] stats select failed:', clickError?.message, orderError?.message)
    res.status(500).json({ error: 'Gagal muatkan statistik.' })
    return
  }

  let confirmedSales = 0
  let pendingSales = 0
  for (const row of orders ?? []) {
    if (row.status === 'paid') confirmedSales++
    else if (row.status === 'pending') pendingSales++
  }

  res.status(200).json({
    affiliate: { username: affiliate.username, name: affiliate.name, status: affiliate.status },
    clickCount: clickCount ?? 0,
    confirmedSales,
    pendingSales,
  })
}
