import { supabase } from '@/lib/supabase'
import { computeSessionStats } from '@/lib/sessionStats'
import type { HistoryPoint } from '@/lib/sessionStats'

// Writes one completed session to Supabase — called once, at the moment
// Skrin 4 freezes (SessionScreen.tsx's endSession). Uses the exact same
// computeSessionStats() Skrin 4 itself renders from, so the numbers saved
// are never a second, independently-derived copy that could disagree with
// what the user actually saw live.
//
// RLS (sessions: insert own, user_id = auth.uid()) is the real enforcement
// here — user_id is included in the insert payload for the policy's WITH
// CHECK to match against, but a mismatched/spoofed user_id would simply be
// rejected by Postgres, not trusted client input.
export async function saveSession({
  userId,
  startedAt,
  durationSec,
  history,
}: {
  userId: string
  startedAt: Date
  durationSec: number
  history: HistoryPoint[]
}): Promise<{ error: string | null }> {
  const stats = computeSessionStats(history)
  const totalZoneSamples = stats.zoneCounts.low + stats.zoneCounts.medium + stats.zoneCounts.high
  const pct = (n: number) => (totalZoneSamples > 0 ? Math.round((n / totalZoneSamples) * 1000) / 10 : null)

  const { error } = await supabase.from('sessions').insert({
    user_id: userId,
    started_at: startedAt.toISOString(),
    duration_sec: Math.round(durationSec),
    coherence_avg: stats.avgCoherence,
    achievement_pct: stats.achievementPct,
    avg_bpm: stats.avgBpm,
    low_pct: pct(stats.zoneCounts.low),
    medium_pct: pct(stats.zoneCounts.medium),
    high_pct: pct(stats.zoneCounts.high),
    // Trimmed to exactly the fields a future Review detail page needs to
    // redraw the charts Skrin 4 already shows — not the full HistoryPoint
    // (which also carries the original computeCoherence value and rmssdMs,
    // neither needed there).
    history: history.map(h => ({ t: h.t, coherenceAlt: h.coherenceAlt, bpm: h.bpm })),
  })

  if (error) {
    console.error('[saveSession] insert failed:', error.message)
    return { error: error.message }
  }
  return { error: null }
}
