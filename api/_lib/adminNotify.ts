// Single choke point for every admin-facing notification this app sends —
// deliberately named generically (not "sendAdminEmail"): the product
// owner's own stated plan is to move this to Telegram later (push
// notifications suit them better while driving/moving around) — every
// call site (api/shipping/save.ts, api/notify/program40-completed.ts, ...)
// should stay untouched when that happens; only this file's internals
// change.
//
// Degrades gracefully without RESEND_API_KEY — same "not configured yet,
// log instead of throw" pattern TOYYIBPAY_SECRET_KEY/CLOUDCONVERT_API_KEY
// already went through before those were set (see git history) — and
// never throws even if the Resend call itself fails, since a
// notification failing must never roll back or block the caller's own
// work (an order/shipping-address save must still succeed either way).
const RESEND_FROM = 'Bernafas <noreply@bernafas.my>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yus09ny@gmail.com'

export async function sendAdminNotification(subject: string, body: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn(`[adminNotify] RESEND_API_KEY belum ditetapkan — notis TIDAK dihantar. Subjek: "${subject}"`)
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: ADMIN_EMAIL,
        subject,
        html: `<pre style="font-family: monospace; white-space: pre-wrap; font-size: 14px;">${body}</pre>`,
      }),
    })
    if (!response.ok) {
      console.error('[adminNotify] Resend request failed:', response.status, await response.text())
    }
  } catch (err) {
    console.error('[adminNotify] Resend request errored:', err)
  }
}
