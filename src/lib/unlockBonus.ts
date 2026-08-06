// ─── Peringkat B unlock trigger — STRUCTURE/LOGIC ONLY ─────────────────────
// Per project brief: after 10 sessions within 3 weeks, a bonus unlocks
// (ebook + Madrasah I AM material). The actual reveal content is deliberately
// NOT wired here — this project's hard rule is zero spiritual/Madrasah I AM
// branding anywhere in the Bernafas UI, which directly conflicts with what
// the unlocked content is supposed to contain. That's a real product/legal
// decision (how does a secular wellness app surface a cross-brand reward
// without becoming a Madrasah I AM ad?) that needs a decision before this
// ships, not something to quietly resolve by omitting the branding rule.
// For now: count sessions, expose eligibility, render a neutral placeholder.

const COUNT_KEY = 'bernafas_session_count'
const FIRST_SESSION_KEY = 'bernafas_first_session_at'

const UNLOCK_SESSION_THRESHOLD = 10
const UNLOCK_WINDOW_DAYS = 21

export function recordSessionCompleted(): void {
  try {
    const count = getSessionCount() + 1
    window.localStorage.setItem(COUNT_KEY, String(count))
    if (!window.localStorage.getItem(FIRST_SESSION_KEY)) {
      window.localStorage.setItem(FIRST_SESSION_KEY, String(Date.now()))
    }
  } catch (err) {
    console.error('[unlockBonus] failed to persist session count:', err)
  }
}

export function getSessionCount(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(COUNT_KEY)
  return raw ? parseInt(raw, 10) || 0 : 0
}

export function isUnlockEligible(): boolean {
  if (typeof window === 'undefined') return false
  const count = getSessionCount()
  if (count < UNLOCK_SESSION_THRESHOLD) return false
  const firstRaw = window.localStorage.getItem(FIRST_SESSION_KEY)
  if (!firstRaw) return false
  const daysSince = (Date.now() - parseInt(firstRaw, 10)) / (1000 * 60 * 60 * 24)
  return daysSince <= UNLOCK_WINDOW_DAYS
}
