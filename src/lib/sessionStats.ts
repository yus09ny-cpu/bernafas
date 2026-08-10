import { getCoherenceZone } from '@/lib/coherenceZones'

// One sample of the live session timeline — pushed by useHrvSession every
// HISTORY_SAMPLE_MS while a real device is feeding R-R data. bpm/rmssdMs can
// individually be null on a sample where the coherence window had enough
// beats but the smoothed BPM hadn't produced a value yet; coherence is never
// null in a pushed point (that's the gate for pushing one at all).
export interface HistoryPoint {
  t: number // seconds since session start
  coherence: number // 0-1 — computeCoherence (hrvCoherence.ts), kept for
  // reference/back-compat but no longer what Skrin 4 displays.
  // "Sumber" — calm-breath-pulse's frequency-domain formula, mirrors
  // coherenceLiveAlt at the moment this sample was taken (see
  // useHrvSession.ts). Can be null on an early sample if coherenceFromBeats
  // hadn't produced its first value yet; in practice this is rare since
  // history sampling itself is gated on having live R-R data already.
  coherenceAlt: number | null
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

// The subset of HistoryPoint that actually gets persisted (see
// sessionPersistence.ts's saveSession — history is trimmed to exactly
// these three fields before insert) and the subset every consumer below
// (computeSessionStats, CoherenceBandChart, HrvLineChart) actually reads.
// A stored session's history loaded back from Supabase is *only* this
// shape, not a full HistoryPoint (no `coherence`/`rmssdMs`) — declaring
// consumers against this narrower type (rather than HistoryPoint) lets
// Review's History detail view reuse them directly on real rows, with no
// dummy fields needed. Live HistoryPoint[] still satisfies this type too
// (structurally a superset), so nothing about the live-session call sites
// changes.
export type SessionHistoryPoint = Pick<HistoryPoint, 't' | 'coherenceAlt' | 'bpm'>

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
//
// avgCoherence/achievementPct/zoneCounts are now derived from
// coherenceAlt ("Sumber"), matching the ring/flower formula standardization
// on Skrin 1-3 — not point.coherence (the original computeCoherence value,
// still present on HistoryPoint but no longer what this function reports).
export function computeSessionStats(history: SessionHistoryPoint[]): SessionStats {
  if (history.length === 0) return EMPTY_STATS

  let coherenceSum = 0
  let coherenceCount = 0
  let bpmSum = 0
  let bpmCount = 0
  const zoneCounts = { low: 0, medium: 0, high: 0 }

  for (const point of history) {
    // coherenceAlt can in principle be null (see HistoryPoint's own doc
    // comment) — skip rather than default to 0, so a handful of early
    // unset samples don't drag the average/achievement% down artificially.
    if (point.coherenceAlt !== null) {
      coherenceSum += point.coherenceAlt
      coherenceCount++
      zoneCounts[getCoherenceZone(point.coherenceAlt)]++
    }
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
  const achievementPct =
    coherenceCount > 0 ? Math.round(((zoneCounts.high * 1 + zoneCounts.medium * 0.5) / coherenceCount) * 100) : null

  return {
    avgCoherence: coherenceCount > 0 ? coherenceSum / coherenceCount : null,
    achievementPct,
    startBpm: history[0].bpm,
    endBpm: history[history.length - 1].bpm,
    avgBpm: bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null,
    zoneCounts,
  }
}
