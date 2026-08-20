export type ProductType = 'buku' | 'pakej_lifetime' | 'sensor' | 'app_subscription'

// Server-side source of truth for what each product actually costs — added
// alongside 'sensor'/'app_subscription' rather than leaving pricing
// client-supplied like the original 'buku'/'pakej_lifetime' code did.
// Previously api/checkout/create-bill.ts trusted whatever `amount` the
// client sent verbatim (BeliLandingScreen.tsx happened to always send the
// right number, but nothing server-side stopped a crafted request from
// creating an order — and later, on payment-callback.ts's paid webhook — for
// RM1). Fixing that for all four products in the same pass this file was
// created for is cheap and directly relevant (this file's whole reason to
// exist is deciding what 'sensor'/'app_subscription' cost), not scope creep.
//
// Prices in ringgit (not sen) — create-bill.ts converts to sen for ToyyibPay.
export const PRODUCT_PRICES: Record<ProductType, number> = {
  buku: 35,
  pakej_lifetime: 499,
  sensor: 350,
  app_subscription: 19.9,
}

// `name` feeds ToyyibPay's billName, which has a 30-BYTE (not 30-character)
// limit — discovered live, 2026-08-20: 'app_subscription's original name
// ('Bernafas — Langganan Aplikasi', 29 JS chars) was rejected by the real
// ToyyibPay API ("billName exceed limit. Max 30 length") the first time
// TOYYIBPAY_SECRET_KEY/TOYYIBPAY_CATEGORY_CODE actually existed for this
// project to test against. The em dash "—" is 1 UTF-16 code unit (what
// .length counts) but 3 UTF-8 bytes — ToyyibPay's own length check is
// byte-based (PHP strlen), so every name below avoids it (plain hyphen or
// no separator) and stays comfortably under 30 bytes, confirmed via
// Buffer.byteLength before shipping this fix, not just eyeballed.
export const PRODUCT_LABELS: Record<ProductType, { name: string; description: string }> = {
  buku: { name: 'Buku Ini Jantungmu', description: 'Pembelian buku Ini Jantungmu' },
  pakej_lifetime: {
    name: 'Pakej Lifetime Bernafas',
    description: 'Pakej Buku + Sensor + Aplikasi (Lifetime)',
  },
  sensor: { name: 'Sensor Bernafas', description: 'Sensor HRV bernafas.my (tanpa buku/aplikasi)' },
  app_subscription: { name: 'Langganan Bernafas', description: 'Akses aplikasi bernafas.my, 30 hari' },
}

export function isProductType(value: unknown): value is ProductType {
  return value === 'buku' || value === 'pakej_lifetime' || value === 'sensor' || value === 'app_subscription'
}
