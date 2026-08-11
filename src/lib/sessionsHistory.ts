import { supabase } from '@/lib/supabase'
import type { SessionHistoryPoint } from '@/lib/sessionStats'

export interface SessionListItem {
  id: string
  startedAt: string
  durationSec: number | null
  coherenceAvg: number | null
  achievementPct: number | null
}

export interface SessionDetail extends SessionListItem {
  avgBpm: number | null
  lowPct: number | null
  mediumPct: number | null
  highPct: number | null
  history: SessionHistoryPoint[]
}

// Review's History list — summary columns only, newest first. Deliberately
// doesn't select `history` here: that jsonb array can be one sample every
// few seconds for a whole session, so pulling it for every row just to
// render a list (rather than only the one row a user actually opens) would
// be a lot of wasted bandwidth. RLS ("sessions: select own", user_id =
// auth.uid()) is what actually scopes this to the signed-in user — no
// explicit .eq('user_id', ...) needed, same trust model already used by
// sessionPersistence.ts's insert. sessions_user_id_started_at_idx
// (0001_init.sql) is this exact query shape, already indexed.
export async function fetchSessionsList(): Promise<{ data: SessionListItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, started_at, duration_sec, coherence_avg, achievement_pct')
    .order('started_at', { ascending: false })

  if (error) {
    console.error('[fetchSessionsList] select failed:', error.message)
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map(row => ({
      id: row.id as string,
      startedAt: row.started_at as string,
      durationSec: row.duration_sec as number | null,
      coherenceAvg: row.coherence_avg as number | null,
      achievementPct: row.achievement_pct as number | null,
    })),
    error: null,
  }
}

// Review's History detail — the one row a tapped list item opens, this
// time including `history` so CoherenceBandChart/HrvLineChart (same
// components Skrin 4 uses live) can redraw from it. RLS scopes this the
// same way fetchSessionsList is scoped; a guessed/foreign id simply
// returns no row rather than another user's session.
export async function fetchSessionDetail(id: string): Promise<{ data: SessionDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, started_at, duration_sec, coherence_avg, achievement_pct, avg_bpm, low_pct, medium_pct, high_pct, history')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[fetchSessionDetail] select failed:', error.message)
    return { data: null, error: error.message }
  }

  return {
    data: {
      id: data.id as string,
      startedAt: data.started_at as string,
      durationSec: data.duration_sec as number | null,
      coherenceAvg: data.coherence_avg as number | null,
      achievementPct: data.achievement_pct as number | null,
      avgBpm: data.avg_bpm as number | null,
      lowPct: data.low_pct as number | null,
      mediumPct: data.medium_pct as number | null,
      highPct: data.high_pct as number | null,
      history: (data.history ?? []) as SessionHistoryPoint[],
    },
    error: null,
  }
}

export interface SessionTrendPoint {
  id: string
  startedAt: string
  durationSec: number | null
  coherenceAvg: number | null
  achievementPct: number | null
  avgBpm: number | null
  mediumPct: number | null
  highPct: number | null
}

// Review's Progress tab — same "no `history`" reasoning as
// fetchSessionsList (four aggregate columns per session is all four trend
// charts need), but ascending this time: Progress's shared x-axis reads
// oldest-to-newest left-to-right, the opposite of History's list.
export async function fetchSessionsTrend(): Promise<{ data: SessionTrendPoint[]; error: string | null }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, started_at, duration_sec, coherence_avg, achievement_pct, avg_bpm, medium_pct, high_pct')
    .order('started_at', { ascending: true })

  if (error) {
    console.error('[fetchSessionsTrend] select failed:', error.message)
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map(row => ({
      id: row.id as string,
      startedAt: row.started_at as string,
      durationSec: row.duration_sec as number | null,
      coherenceAvg: row.coherence_avg as number | null,
      achievementPct: row.achievement_pct as number | null,
      avgBpm: row.avg_bpm as number | null,
      mediumPct: row.medium_pct as number | null,
      highPct: row.high_pct as number | null,
    })),
    error: null,
  }
}

// Minutes spent in medium+high coherence for one session — derived from
// two already-stored columns (duration_sec × the medium/high zone
// percentages saveSession() computed at session end), not a new stored
// field. Null if the session has no zone data at all (e.g. no device was
// connected), same "missing, not zero" distinction sessionStats.ts's own
// null-handling uses elsewhere.
export function minutesInCoherence(point: SessionTrendPoint): number | null {
  if (point.durationSec === null || (point.mediumPct === null && point.highPct === null)) return null
  const pct = (point.mediumPct ?? 0) + (point.highPct ?? 0)
  return (point.durationSec * pct) / 100 / 60
}
