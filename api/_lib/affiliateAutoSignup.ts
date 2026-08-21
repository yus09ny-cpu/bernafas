import { supabaseAdmin } from './supabaseAdmin.js'
import { USERNAME_PATTERN } from '../affiliate.js'

// Auto-affiliate-on-purchase (2026-08-21, spec item 2) — called from
// api/checkout/callback.ts right after an order is marked 'paid'. Anyone
// who buys ANY product (buku/sensor/pakej_lifetime/app_subscription)
// becomes an affiliate immediately, no registration form.
//
// SAFETY CONTRACT (explicit spec requirement, item 3): this function must
// NEVER throw and must NEVER be the reason a payment webhook fails. Order
// status is the priority; affiliate creation is a bonus. Every step below
// checks its own error and returns early (logs, doesn't throw) — the
// exported function ALSO wraps everything in try/catch as a second layer,
// and the caller (callback.ts) wraps its own call in try/catch as a THIRD
// layer. Redundant on purpose for a payment-critical path.
//
// auth_user_id is deliberately left NULL — no auth account is created
// here. The EXISTING auto-link-by-email logic (api/affiliate.ts's
// action=me) is what connects this row to a real login the first time
// the buyer actually signs in/registers with this email (Google, magic
// email+password, or a later manual registration attempt that finds
// their email already has a row) — reusing that infra, not building a
// parallel one.
const RESEND_FROM = 'Bernafas <noreply@bernafas.my>'
const MAX_USERNAME_ATTEMPTS = 5
const RANDOM_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomSuffix(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += RANDOM_SUFFIX_CHARS[Math.floor(Math.random() * RANDOM_SUFFIX_CHARS.length)]
  return out
}

// Local-part of the email, sanitized down to USERNAME_PATTERN's allowed
// charset (lowercase a-z0-9_-, 3-32 chars) — e.g. "John.Doe+tag@x.com" ->
// "johndoetag". Padded with a random suffix if stripping leaves it under
// 3 chars (e.g. an email like "a@x.com" or "++@x.com").
function baseUsernameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  const stripped = localPart.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
  if (stripped.length >= 3) return stripped
  return (stripped + randomSuffix(3 - stripped.length)) || `affiliate${randomSuffix(4)}`
}

async function generateUniqueUsername(email: string): Promise<string | null> {
  const base = baseUsernameFromEmail(email)

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 32 - 5)}-${randomSuffix(4)}`
    if (!USERNAME_PATTERN.test(candidate)) continue

    const { data: existing, error } = await supabaseAdmin.from('affiliates').select('id').eq('username', candidate).maybeSingle()
    if (error) {
      console.error('[affiliateAutoSignup] username uniqueness check failed:', error.message)
      return null
    }
    if (!existing) return candidate
  }
  return null
}

// displayName has no real source anywhere in this app — `orders` carries
// no buyer name (only email), and `profiles` has none either (confirmed:
// neither table has ever had a name column). The email's local part is
// the only data available, so it doubles as both username seed and
// display name — same reasoning, same source, not a separate decision.
function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'Affiliate'
  return localPart.charAt(0).toUpperCase() + localPart.slice(1)
}

async function notifyNewAutoAffiliate(email: string, username: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn(`[affiliateAutoSignup] RESEND_API_KEY belum ditetapkan — e-mel affiliate baharu TIDAK dihantar (${email}, username=${username}).`)
    return
  }

  const referralLink = `https://bernafas.my/beli?ref=${username}`
  const html = `
    <div style="font-family: sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937;">
      <p>Terima kasih kerana membeli produk Bernafas!</p>
      <p>Sebagai penghargaan, anda kini secara automatik didaftarkan sebagai <strong>Affiliate Bernafas</strong> — username anda: <strong>${username}</strong>.</p>
      <p>Pautan rujukan anda:<br><a href="${referralLink}">${referralLink}</a></p>
      <p>Untuk akses dashboard affiliate anda (semak klik, jualan, dan komisen), log masuk di <a href="https://bernafas.my/affiliate/log-masuk">bernafas.my/affiliate/log-masuk</a> guna e-mel ini — melalui Google, ATAU tetapkan kata laluan pertama anda dengan klik "Lupa kata laluan?" (belum ada kata laluan wujud untuk akaun ini lagi).</p>
    </div>
  `.trim()

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: email,
        subject: 'Anda kini Affiliate Bernafas!',
        html,
      }),
    })
    if (!response.ok) {
      console.error('[affiliateAutoSignup] buyer notification Resend request failed:', response.status, await response.text())
    }
  } catch (err) {
    console.error('[affiliateAutoSignup] buyer notification Resend request errored:', err)
  }
}

export async function autoCreateAffiliateForOrder(orderId: string, email: string | null): Promise<void> {
  try {
    if (!email) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) return

    // Already an affiliate (self-registered earlier, or a previous order
    // from this same email already auto-created one) — never duplicate.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingError) {
      console.error(`[affiliateAutoSignup] existing-affiliate check failed for order ${orderId}:`, existingError.message)
      return
    }
    if (existing) return

    const username = await generateUniqueUsername(normalizedEmail)
    if (!username) {
      console.error(`[affiliateAutoSignup] could not generate a unique username for order ${orderId} (${normalizedEmail})`)
      return
    }

    const { error: insertError } = await supabaseAdmin.from('affiliates').insert({
      name: displayNameFromEmail(normalizedEmail),
      email: normalizedEmail,
      username,
      status: 'pending', // same default as self-registration (api/affiliate.ts's handleRegister) — status isn't enforced/gated anywhere in this codebase today, purely informational
      auth_user_id: null,
    })

    if (insertError) {
      console.error(`[affiliateAutoSignup] affiliate insert failed for order ${orderId}:`, insertError.message)
      return
    }

    await notifyNewAutoAffiliate(normalizedEmail, username)
  } catch (err) {
    // Belt-and-suspenders — every step above already catches its own
    // errors, but this outer catch guarantees this function NEVER throws,
    // no matter what.
    console.error(`[affiliateAutoSignup] unexpected error for order ${orderId}:`, err)
  }
}
