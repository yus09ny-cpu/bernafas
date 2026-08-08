import { getCoherenceZone } from '@/lib/coherenceZones'

// One sample of the live session timeline — pushed by useHrvSession every
// HISTORY_SAMPLE_MS while a real device is feeding R-R data. bpm/rmssdMs can
// individually be null on a sample where the coherence window had enough
// beats but the smoothed BPM hadn't produced a value yet; coherence is never
// null in a pushed point (that's the gate for pushing one at all).
export interface HistoryPoint {
  t: number // seconds since session start
  coherence: number // 0-1
  bpm: number | null
  rmssdMs: number | null
}

export interface SessionStats {
  avgCoherence: number | null
  achievementPct: number | null
  startBpm: number | null
  endBpm: number | null
  avgBpm: number | null
  zoneCounts: Record<'low' | 'medium' | 'high', number>
}

const EMPTY_STATS: SessionStats = {
  avgCoherence: null,
  achievementPct: null,
  startBpm: null,
  endBpm: null,
  avgBpm: null,
  zoneCounts: { low: 0, medium: 0, high: 0 },
}

// Derived, not stored — Page 4 (and the segmented ring) call this on the
// same `history` array pages 1-3 read from, so there is exactly one source
// of truth for "how did this session go," live or already ended.
export function computeSessionStats(history: HistoryPoint[]): SessionStats {
  if (history.length === 0) return EMPTY_STATS

  let coherenceSum = 0
  let bpmSum = 0
  let bpmCount = 0
  const zoneCounts = { low: 0, medium: 0, high: 0 }

  for (const point of history) {
    coherenceSum += point.coherence
    zoneCounts[getCoherenceZone(point.coherence)]++
    if (point.bpm !== null) {
      bpmSum += point.bpm
      bpmCount++
    }
  }

  // Achievement% — weighted time-in-zone, matching HeartMath Inner Balance's
  // "Achievement" score: every sample counts fully toward the score if it
  // landed in the high zone, half if medium, zero if low. Not a peer-reviewed
  // formula, just the same intuitive "reward sustained high coherence, give
  // partial credit for medium" weighting as the source product.
  const achievementPct = Math.round(
    ((zoneCounts.high * 1 + zoneCounts.medium * 0.5) / history.length) * 100,
  )

  return {
    avgCoherence: coherenceSum / history.length,
    achievementPct,
    startBpm: history[0].bpm,
    endBpm: history[history.length - 1].bpm,
    avgBpm: bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null,
    zoneCounts,
  }
}
