import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'

// GET /api/app-access/status — the gate App.tsx checks before rendering
// the tab shell (wired 2026-08-20; no existing users to grandfather, per
// product owner confirmation — see App.tsx's own comment).
//
// Two INDEPENDENT ways to have access, deliberately not merged into one
// profiles-column check:
//
// 1. profiles.subscription_tier === 'active' AND not expired — the
//    RM19.90/bulan recurring path (api/checkout/callback.ts writes this on
//    each paid app_subscription order). Re-checks subscription_expiry LIVE
//    against `now` here rather than trusting the tier flag alone —
//    check-subscriptions.ts's cron only runs once a day, so a flag that
//    just expired minutes ago could otherwise still read 'active' for up
//    to ~24h. This closes that window without waiting on the cron.
//
// 2. A paid 'pakej_lifetime' order exists for this user (user_id OR a
//    case-insensitive email match — same reasoning as api/book/full.ts:
//    /beli is guest-checkout-friendly, so the order may carry only an
//    email, not user_id). Deliberately NOT written through to
//    profiles.subscription_tier at payment time — pakej_lifetime's
//    "Akses aplikasi selamanya" (lifetime access, no monthly billing) is
//    computed live here instead, kept fully separate from the recurring
//    subscription mechanism rather than faking a permanent 'active' row
//    for it.
//
// 'buku' alone and 'sensor' alone do NOT grant app access — 'buku' is the
// book only, 'sensor' is hardware only (same reasoning already established
// for api/book/full.ts's book-access check: only pakej_lifetime's own
// marketing copy says "Akses aplikasi selamanya", buku/sensor's copy never
// mentions app access at all).
const LIFETIME_PRODUCT_TYPES = ['pakej_lifetime']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  // Bug fix (2026-08-21): this gate was blocking the product owner's own
  // master-admin account, demanding a subscription like any other user.
  // ANY admin tier (master/super/admin — supabase/migrations/0007_admin_roles.sql)
  // bypasses the subscription/lifetime-purchase gate entirely — an admin's
  // reason for using the app (managing shipments, testing, etc.) has
  // nothing to do with their own subscription status, same reasoning
  // AdminShippingScreen.tsx's own comment already applies to reaching
  // /admin/* outside this gate. This is the SAME gap for the regular tab
  // shell (Sesi/Jurnal/etc.), not just the admin-only screens.
  if (await hasAdminRole(user, 'admin')) {
    res.status(200).json({ hasAccess: true, reason: 'admin', subscriptionExpiry: null })
    return
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier, subscription_expiry')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[api/app-access/status] profile lookup failed:', profileError.message)
    res.status(500).json({ error: 'Gagal semak status akaun.' })
    return
  }

  const subscriptionActive =
    profile?.subscription_tier === 'active' &&
    (profile.subscription_expiry === null || new Date(profile.subscription_expiry) > new Date())

  if (subscriptionActive) {
    res.status(200).json({ hasAccess: true, reason: 'subscription', subscriptionExpiry: profile.subscription_expiry })
    return
  }

  const { data: lifetimeOrder, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', LIFETIME_PRODUCT_TYPES)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (orderError) {
    console.error('[api/app-access/status] order lookup failed:', orderError.message)
    res.status(500).json({ error: 'Gagal semak pembelian.' })
    return
  }

  if (lifetimeOrder) {
    res.status(200).json({ hasAccess: true, reason: 'lifetime', subscriptionExpiry: null })
    return
  }

  res.status(200).json({ hasAccess: false, reason: null, subscriptionExpiry: null })
}
