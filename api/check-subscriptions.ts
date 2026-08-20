import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

// Vercel Cron — daily check of the RM19.90/bulan app-access subscription
// (profiles.subscription_tier/subscription_expiry, extended by
// api/checkout/callback.ts on each paid 'app_subscription' order). Ported
// from madrasah-iam's api/check-subscriptions.ts (same reminder+downgrade
// shape, same cron schedule convention) rather than invented fresh — see
// this session's own notes. Simplified vs. that source: bernafas has only
// two tiers ('free'/'active', not pro/pro_plus), no referral-discount
// auto-extend branch (bernafas has no referral program), and profiles
// already HAS an `email` column here (unlike madrasah-iam's profiles,
// which had to go through auth.admin.getUserById for it) — so this reads
// it directly.
//
// Reminder emails degrade gracefully without RESEND_API_KEY (as of this
// file's creation, bernafas has no Resend integration/env var set at all —
// same "not configured yet" state TOYYIBPAY_SECRET_KEY was in when
// create-bill.ts was first written) — logged, not sent, never blocks the
// downgrade logic below it.
//
// Registered in vercel.json's `crons` array: "0 0 * * *" UTC = 8:00 AM
// (GMT+8), same time-of-day convention as madrasah-iam's cron.
const RESEND_FROM = 'Bernafas <noreply@bernafas.my>'
const RENEW_URL = 'https://bernafas.my/beli-langganan' // placeholder route — no in-app subscribe screen wired to a public URL yet

function formatTarikh(iso: string) {
  return new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

function reminderEmailHtml(tarikh: string) {
  return `
    <div style="font-family: Georgia, serif; background:#f7f3ec; color:#2b2420; padding:32px; border-radius:16px; max-width:480px; margin:auto;">
      <h2 style="margin-top:0;">Assalamualaikum,</h2>
      <p>Langganan aplikasi <strong>bernafas.my</strong> anda akan tamat pada <strong>${tarikh}</strong>.</p>
      <p>Perbaharui sekarang untuk terus mengakses aplikasi.</p>
      <p style="text-align:center; margin: 28px 0;">
        <a href="${RENEW_URL}" style="background:#2b6f5c; color:#fff; padding:12px 28px; border-radius:12px; text-decoration:none; font-weight:bold;">Perbaharui Sekarang</a>
      </p>
    </div>
  `
}

function downgradeEmailHtml() {
  return `
    <div style="font-family: Georgia, serif; background:#f7f3ec; color:#2b2420; padding:32px; border-radius:16px; max-width:480px; margin:auto;">
      <h2 style="margin-top:0;">Assalamualaikum,</h2>
      <p>Langganan aplikasi <strong>bernafas.my</strong> anda telah tamat tempoh.</p>
      <p>Anda boleh melanggan semula pada bila-bila masa untuk mendapatkan semula akses.</p>
      <p style="text-align:center; margin: 28px 0;">
        <a href="${RENEW_URL}" style="background:#2b6f5c; color:#fff; padding:12px 28px; border-radius:12px; text-decoration:none; font-weight:bold;">Langgan Semula</a>
      </p>
    </div>
  `
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  }).catch(err => console.error('[check-subscriptions] Resend error:', err))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).send('Unauthorized')
      return
    }
  }

  const resendKey = process.env.RESEND_API_KEY
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // 1. Reminder — subscription tamat dalam 3 hari, belum dihantar reminder
  // hari ini.
  const { data: reminderUsers, error: reminderError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, subscription_expiry, last_reminder_sent')
    .eq('subscription_tier', 'active')
    .gt('subscription_expiry', now.toISOString())
    .lte('subscription_expiry', in3Days.toISOString())

  let remindersSent = 0
  if (reminderError) {
    console.error('[check-subscriptions] reminder query error:', reminderError.message)
  } else {
    for (const u of reminderUsers ?? []) {
      if (!u.subscription_expiry) continue
      if (u.last_reminder_sent && u.last_reminder_sent.slice(0, 10) === todayStr) continue

      if (resendKey && u.email) {
        await sendEmail(resendKey, u.email, 'Langganan aplikasi anda akan tamat', reminderEmailHtml(formatTarikh(u.subscription_expiry)))
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ last_reminder_sent: now.toISOString() })
        .eq('id', u.id)
      if (updateError) {
        console.error(`[check-subscriptions] gagal tanda reminder untuk ${u.id}:`, updateError.message)
        continue
      }
      remindersSent++
    }
  }

  // 2. Downgrade — subscription sudah tamat. subscription_expiry IS NULL
  // (a manually grandfathered profile, per 0005's migration header) is
  // excluded by `.not('subscription_expiry', 'is', null)` — never
  // auto-downgraded.
  const { data: expiredUsers, error: expiredError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, subscription_expiry')
    .eq('subscription_tier', 'active')
    .not('subscription_expiry', 'is', null)
    .lt('subscription_expiry', now.toISOString())

  let downgraded = 0
  if (expiredError) {
    console.error('[check-subscriptions] expired query error:', expiredError.message)
  } else {
    for (const u of expiredUsers ?? []) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ subscription_tier: 'free' })
        .eq('id', u.id)
      if (updateError) {
        console.error(`[check-subscriptions] gagal downgrade ${u.id}:`, updateError.message)
        continue
      }

      if (resendKey && u.email) {
        await sendEmail(resendKey, u.email, 'Langganan aplikasi anda telah tamat', downgradeEmailHtml())
      }
      downgraded++
    }
  }

  console.log(`[check-subscriptions] remindersSent=${remindersSent} downgraded=${downgraded}`)
  res.status(200).json({ remindersSent, downgraded })
}
