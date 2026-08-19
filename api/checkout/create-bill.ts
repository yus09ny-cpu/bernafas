import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin'

// Minimal ToyyibPay checkout skeleton — built as scaffolding for item 6
// (affiliate_ref needs somewhere to flow INTO), not a finished payment
// feature. Pricing itself is deliberately NOT hardcoded here (same
// reasoning as affiliate_commission_rates being left unset) — the caller
// supplies amount, this route doesn't decide what a book/lifetime package
// costs.
//
// Degrades gracefully if TOYYIBPAY_SECRET_KEY/TOYYIBPAY_CATEGORY_CODE
// aren't set in Vercel yet (they aren't, as of this file's creation — no
// TOYYIBPAY_* env vars exist for this project) — the `orders` row (with
// affiliate_ref filled) still gets created either way, so the affiliate
// attribution plumbing itself is exercised end-to-end even before real
// ToyyibPay credentials are added; `paymentUrl` is just null until then.
const TOYYIBPAY_BASE_URL = 'https://toyyibpay.com'

interface CreateBillBody {
  productType?: string
  amount?: number // ringgit, not sen — converted below
  email?: string
  affiliateRef?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { productType, amount, email, affiliateRef } = (req.body ?? {}) as CreateBillBody

  if (productType !== 'buku' && productType !== 'pakej_lifetime') {
    res.status(400).json({ error: 'productType mesti "buku" atau "pakej_lifetime".' })
    return
  }
  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'amount diperlukan (RM, > 0).' })
    return
  }

  const { data: order, error: insertError } = await supabaseAdmin
    .from('orders')
    .insert({
      product_type: productType,
      amount,
      email: email?.trim() || null,
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

  const form = new URLSearchParams({
    userSecretKey: secretKey,
    categoryCode,
    billName: productType === 'buku' ? 'Ini Jantungmu — Buku' : 'Ini Jantungmu — Pakej Lifetime',
    billDescription: productType === 'buku' ? 'Pembelian buku Ini Jantungmu' : 'Pakej Buku + Sensor + Aplikasi (Lifetime)',
    billPriceSetting: '1',
    billPayorInfo: '1',
    billAmount: String(Math.round(amount * 100)), // sen
    billReturnUrl: `${siteUrl}/beli/selesai`,
    billCallbackUrl: `${siteUrl}/api/checkout/callback`,
    billExternalReferenceNo: order.id,
    billTo: email?.trim() || 'Pelanggan Bernafas',
    billEmail: email?.trim() || 'admin@bernafas.my',
    billPhone: '',
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
