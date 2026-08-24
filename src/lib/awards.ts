import type { SessionTrendPoint } from '@/lib/sessionsHistory'
import { minutesInCoherence } from '@/lib/sessionsHistory'
import { formatSessionDate } from '@/lib/utils'

// ─── Anugerah (Awards) — badges derived entirely from the sessions table ──
// No new schema: every badge is a pure function of the same
// SessionTrendPoint[] Progress already fetches (fetchSessionsTrend,
// ascending oldest→newest — that ordering is load-bearing here, not
// incidental, since "the Nth session" / "first date a tier was reached" /
// "consecutive sessions" all require walking history in chronological
// order). AwardsTab does its own fetchSessionsTrend() call rather than
// sharing ProgressTab's in-memory state (there's no cross-tab cache
// anywhere in this app — HistoryTab/ProgressTab each fetch fresh on mount
// too), but it is the exact same query shape/columns, no new backend
// surface.

export type AwardCategory = 'practice' | 'sameDay' | 'streak'

export interface AwardStatus {
  id: string
  category: AwardCategory
  threshold: number
  color: string
  label: string
  earned: boolean
  achievedAt: string | null
  description: string
}

export interface AwardGroup {
  category: AwardCategory
  title: string
  badges: AwardStatus[]
}

export const PRACTICE_TIERS = [10, 25, 50, 100] as const
export const SAME_DAY_TIERS = [3, 5] as const
export const STREAK_TIERS = [3, 10, 25] as const
export const STREAK_HIGH_PCT_THRESHOLD = 50

// Practice-count tiers deepen along the app's own primary teal ramp
// (--color-primary-light/--color-primary/--color-primary-dark from
// index.css) plus one further hand-picked shade for the top tier — the
// same family already used for "pencapaian" everywhere else, not a new
// palette invented just for badges.
const PRACTICE_COLORS: Record<number, string> = {
  10: '#6fc3bd',
  25: '#3e9c9c',
  50: '#2c7a7a',
  100: '#1f5c5c',
}

// Same-day tiers use the app's existing accent blue, plus one deeper
// hand-picked shade for the harder tier — kept out of the teal/green
// families above so the three categories stay visually distinct at a
// glance in the grid.
const SAME_DAY_COLORS: Record<number, string> = {
  3: '#6fa8dc',
  5: '#4a7ab8',
}

// Streak tiers reuse ZONE_COLOR.high (#3fae7a, coherenceZones.ts) verbatim
// at the middle tier — this category's condition IS "time in the high
// zone", so the badge should read as the same green a user already
// associates with high coherence, not a badge-specific invention. Lighter/
// darker shades bracket it for the easier/harder tiers.
const STREAK_COLORS: Record<number, string> = {
  3: '#8cd1ae',
  10: '#3fae7a',
  25: '#276b49',
}

// Local-date key (not UTC) so "same day" matches what the user actually
// experienced as one calendar day, same reasoning formatSessionDate/
// formatSessionTime already use their own toLocale*String without an
// explicit timezone. en-CA's locale output is the one built-in
// toLocaleDateString format that's already YYYY-MM-DD, so it doubles as a
// sortable map key with zero extra parsing.
function calendarDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

function computePracticeBadges(sessions: SessionTrendPoint[]): AwardStatus[] {
  return PRACTICE_TIERS.map(threshold => {
    const earned = sessions.length >= threshold
    const achievedAt = earned ? sessions[threshold - 1].startedAt : null
    return {
      id: `practice-${threshold}`,
      category: 'practice',
      threshold,
      color: PRACTICE_COLORS[threshold],
      label: `${threshold} Sesi`,
      earned,
      achievedAt,
      description: earned
        ? `Anda telah berlatih sebanyak ${threshold} kali, dicapai pada ${formatSessionDate(achievedAt!)}.`
        : `Berlatih sebanyak ${threshold} kali untuk membuka anugerah ini.`,
    }
  })
}

function computeSameDayBadges(sessions: SessionTrendPoint[]): AwardStatus[] {
  const countByDate = new Map<string, number>()
  const firstReachedAt = new Map<number, string>()

  for (const s of sessions) {
    const key = calendarDateKey(s.startedAt)
    const count = (countByDate.get(key) ?? 0) + 1
    countByDate.set(key, count)
    for (const tier of SAME_DAY_TIERS) {
      if (count === tier && !firstReachedAt.has(tier)) {
        firstReachedAt.set(tier, s.startedAt)
      }
    }
  }

  return SAME_DAY_TIERS.map(threshold => {
    const achievedAt = firstReachedAt.get(threshold) ?? null
    const earned = achievedAt !== null
    return {
      id: `sameday-${threshold}`,
      category: 'sameDay',
      threshold,
      color: SAME_DAY_COLORS[threshold],
      label: `${threshold}x Sehari`,
      earned,
      achievedAt,
      description: earned
        ? `Anda berlatih ${threshold} kali dalam sehari pada ${formatSessionDate(achievedAt!)}.`
        : `Berlatih ${threshold} kali dalam satu hari yang sama untuk membuka anugerah ini.`,
    }
  })
}

// Consecutive means consecutive in the user's own session history, not
// consecutive calendar days — a gap of days between two qualifying
// sessions doesn't break the streak, only a non-qualifying session (or one
// with no high_pct at all, e.g. no device connected) does. Each tier
// records the startedAt of the session that FIRST completed it, so a much
// longer streak later doesn't retroactively move an earlier tier's date.
function computeStreakBadges(sessions: SessionTrendPoint[]): AwardStatus[] {
  let currentStreak = 0
  const firstReachedAt = new Map<number, string>()

  for (const s of sessions) {
    const qualifies = s.highPct !== null && s.highPct > STREAK_HIGH_PCT_THRESHOLD
    currentStreak = qualifies ? currentStreak + 1 : 0
    if (qualifies) {
      for (const tier of STREAK_TIERS) {
        if (currentStreak === tier && !firstReachedAt.has(tier)) {
          firstReachedAt.set(tier, s.startedAt)
        }
      }
    }
  }

  return STREAK_TIERS.map(threshold => {
    const achievedAt = firstReachedAt.get(threshold) ?? null
    const earned = achievedAt !== null
    return {
      id: `streak-${threshold}`,
      category: 'streak',
      threshold,
      color: STREAK_COLORS[threshold],
      label: `${threshold} Berturut`,
      earned,
      achievedAt,
      description: earned
        ? `Koheren tinggi melebihi 50% masa untuk ${threshold} sesi berturut-turut, berakhir pada ${formatSessionDate(achievedAt!)}.`
        : `Capai koheren tinggi melebihi 50% masa untuk ${threshold} sesi berturut-turut untuk membuka anugerah ini.`,
    }
  })
}

export function computeAwards(sessions: SessionTrendPoint[]): AwardGroup[] {
  return [
    { category: 'practice', title: 'Ketekunan', badges: computePracticeBadges(sessions) },
    { category: 'sameDay', title: 'Sehari Pelbagai Kali', badges: computeSameDayBadges(sessions) },
    { category: 'streak', title: 'Aliran Koheren', badges: computeStreakBadges(sessions) },
  ]
}

// Lifetime total shown at the top of Anugerah — total minutes spent in
// medium+high coherence, summed across every session ever recorded.
// Reuses minutesInCoherence() (sessionsHistory.ts) per-session rather than
// re-deriving the medium/high% → minutes math a second time here; sessions
// with no zone data at all contribute 0, same "missing, not zero" call
// minutesInCoherence already makes.
export function lifetimeCoherenceMinutes(sessions: SessionTrendPoint[]): number {
  return Math.round(sessions.reduce((sum, s) => sum + (minutesInCoherence(s) ?? 0), 0))
}
