import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { PRODUCT_PRICES, PRODUCT_LABELS, isProductType } from '../_lib/pricing.js'

// ToyyibPay checkout — now backs 4 product types (was 2): 'buku',
// 'pakej_lifetime' (both pre-existing, /beli, guest-friendly), plus
// 'sensor' (RM350, /beli, guest-friendly) and 'app_subscription' (RM19.90,
// signed-in only — see the auth requirement below) added this session.
//
// Pricing is now a server-side constant (api/_lib/pricing.ts), NOT
// client-supplied — the original code trusted whatever `amount` the caller
// sent. See pricing.ts's own header for why fixing that now (not just for
// the 2 new products) was in-scope.
//
// Degrades gracefully if TOYYIBPAY_SECRET_KEY/TOYYIBPAY_CATEGORY_CODE
// aren't set in Vercel yet (as of this file's original creation, they
// weren't) — the `orders` row still gets created either way, so
// affiliate-attribution/user_id plumbing is exercised end-to-end even
// before real ToyyibPay credentials exist; `paymentUrl` is just null.
const TOYYIBPAY_BASE_URL = 'https://toyyibpay.com'

interface CreateBillBody {
  productType?: string
  email?: string
  affiliateRef?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { productType, email, affiliateRef } = (req.body ?? {}) as CreateBillBody

  if (!isProductType(productType)) {
    res.status(400).json({ error: "productType mesti 'buku', 'pakej_lifetime', 'sensor', atau 'app_subscription'." })
    return
  }

  // Authorization header is OPTIONAL for the 3 guest-checkout products
  // (/beli is deliberately unauthenticated — see src/main.tsx's PublicRoot
  // comment) but REQUIRED for app_subscription: a subscription only means
  // something tied to a specific signed-in profile (check-subscriptions.ts
  // extends profiles.subscription_expiry by user_id, there's no "guest
  // subscription" concept), so there's nothing sensible to create without
  // it.
  const verifiedUser = await verifyUser(req)

  if (productType === 'app_subscription' && !verifiedUser) {
    res.status(401).json({ error: 'Sila log masuk dahulu untuk melanggan aplikasi.' })
    return
  }

  const amount = PRODUCT_PRICES[productType]

  const { data: order, error: insertError } = await supabaseAdmin
    .from('orders')
    .insert({
      product_type: productType,
      amount,
      // Prefer the verified email over whatever the client sent — for a
      // signed-in caller, the token-verified address is the trustworthy
      // one; for a guest checkout (no token), fall back to the form field
      // as before.
      email: verifiedUser?.email ?? email?.trim() ?? null,
      user_id: verifiedUser?.id ?? null,
      status: 'pending',
      affiliate_ref: affiliateRef?.trim() || null,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[api/checkout/create-bill] order insert failed:', insertError.message)
    res.status(500).json({ error: 'Gagal cipta order.' })
    return
  }

  const secretKey = process.env.TOYYIBPAY_SECRET_KEY
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE

  if (!secretKey || !categoryCode) {
    console.warn('[api/checkout/create-bill] TOYYIBPAY_SECRET_KEY/TOYYIBPAY_CATEGORY_CODE not set — order created, no bill.')
    res.status(200).json({ orderId: order.id, paymentUrl: null, warning: 'ToyyibPay belum dikonfigurasi.' })
    return
  }

  const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://bernafas.my'
  const { name: billName, description: billDescription } = PRODUCT_LABELS[productType]
  const billEmail = verifiedUser?.email ?? email?.trim() ?? 'admin@bernafas.my'

  const form = new URLSearchParams({
    userSecretKey: secretKey,
    categoryCode,
    billName,
    billDescription,
    billPriceSetting: '1',
    billPayorInfo: '1',
    billAmount: String(Math.round(amount * 100)), // sen
    billReturnUrl: `${siteUrl}/beli/selesai`,
    billCallbackUrl: `${siteUrl}/api/checkout/callback`,
    billExternalReferenceNo: order.id,
    billTo: billEmail,
    billEmail,
    // ToyyibPay rejects an empty billPhone outright ("billPhone parameter
    // is empty") — discovered live, 2026-08-20, the first time a real
    // createBill call actually reached ToyyibPay for this project. No UI
    // anywhere collects a phone number yet (BeliLandingScreen doesn't ask
    // for one), so this is a placeholder — same "graceful default, not a
    // real capture flow" reasoning as billTo/billEmail's own fallback
    // above. A real phone-collection step is a separate, later piece of
    // work if ToyyibPay's own dashboard ever needs to actually reach a
    // buyer by phone.
    billPhone: '0100000000',
  })

  try {
    const response = await fetch(`${TOYYIBPAY_BASE_URL}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const result = (await response.json()) as Array<{ BillCode?: string }>
    const billCode = result?.[0]?.BillCode

    if (!billCode) {
      console.error('[api/checkout/create-bill] ToyyibPay did not return a BillCode:', JSON.stringify(result))
      res.status(502).json({ orderId: order.id, paymentUrl: null, error: 'ToyyibPay gagal cipta bil.' })
      return
    }

    await supabaseAdmin.from('orders').update({ toyyibpay_bill_code: billCode }).eq('id', order.id)

    res.status(200).json({ orderId: order.id, paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}` })
  } catch (err) {
    console.error('[api/checkout/create-bill] ToyyibPay request failed:', err)
    res.status(502).json({ orderId: order.id, paymentUrl: null, error: 'Gagal hubungi ToyyibPay.' })
  }
}
