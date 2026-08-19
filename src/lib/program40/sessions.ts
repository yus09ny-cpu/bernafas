import { supabase } from '@/lib/supabase'
import { getPhaseForDay, getWeekForDay, PROGRAM_40_DAY_TOTAL, type Program40Technique } from '@/lib/program40/curriculum'
import { addDaysISODate, todayLocalISODate } from '@/lib/program40/date'
import type { Program40Session, Program40SelfRating } from '@/lib/program40/types'

function fromRow(row: {
  id: string
  user_id: string
  session_date: string
  day_number: number
  week_number: number
  phase: string
  technique: string
  device_used: boolean
  duration_seconds: number
  hrv_score: number | null
  self_rating: string | null
  notes: string | null
  created_at: string
}): Program40Session {
  return {
    id: row.id,
    userId: row.user_id,
    sessionDate: row.session_date,
    dayNumber: row.day_number,
    weekNumber: row.week_number,
    phase: row.phase as Program40Session['phase'],
    technique: row.technique as Program40Session['technique'],
    deviceUsed: row.device_used,
    durationSeconds: row.duration_seconds,
    hrvScore: row.hrv_score,
    selfRating: row.self_rating as Program40SelfRating | null,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

// All of this user's 40-day sessions, chronological — the single fetch both
// Program40Dashboard's calendar and its two device/no-device tabs read from
// (filtered client-side by device_used), so the two tabs and the calendar
// can never disagree about what's been logged.
export async function fetchProgram40Sessions(userId: string): Promise<{ data: Program40Session[]; error: string | null }> {
  const { data, error } = await supabase
    .from('program_40_day_sessions')
    .select('id, user_id, session_date, day_number, week_number, phase, technique, device_used, duration_seconds, hrv_score, self_rating, notes, created_at')
    .eq('user_id', userId)
    .order('session_date', { ascending: true })

  if (error) {
    console.error('[program40/sessions] select failed:', error.message)
    return { data: [], error: error.message }
  }
  return { data: (data ?? []).map(fromRow), error: null }
}

// Which of the 40 days *today's* session should count as. If a session was
// already logged today (this is an extra/second practice the same day), it
// reuses that same day_number rather than advancing further — day_number
// only ever advances on the first session of a new calendar day. Otherwise
// it's the next uncovered day after the enrollment's current cached
// progress, capped at 40 so a very-late extra session past day 40 doesn't
// overflow the check constraint.
export async function resolveDayNumberForToday(userId: string, currentDay: number): Promise<{ dayNumber: number; error: string | null }> {
  const today = todayLocalISODate()
  const { data, error } = await supabase
    .from('program_40_day_sessions')
    .select('day_number')
    .eq('user_id', userId)
    .eq('session_date', today)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[program40/sessions] resolveDayNumberForToday select failed:', error.message)
    return { dayNumber: Math.min(PROGRAM_40_DAY_TOTAL, currentDay + 1), error: error.message }
  }
  if (data) return { dayNumber: data.day_number, error: null }
  return { dayNumber: Math.min(PROGRAM_40_DAY_TOTAL, currentDay + 1), error: null }
}

export interface SaveProgram40SessionInput {
  userId: string
  dayNumber: number
  // User-picked (TechniquePicker.tsx), from whichever list
  // getAvailableTechniquesForDay(dayNumber) returned — never derived here,
  // so a day with 4 unlocked techniques can actually be logged as any of
  // the 4, not silently forced to one.
  technique: Program40Technique
  durationSeconds: number
  deviceUsed: boolean
  // Exactly one of these two is expected non-null — device_used=true pairs
  // with hrvScore, device_used=false pairs with selfRating (see
  // program_40_day_sessions' check constraints). Not enforced by this
  // function's type signature since the two call sites (device/no-device
  // runners) already only ever have one to pass.
  hrvScore?: number | null
  selfRating?: Program40SelfRating | null
  notes?: string | null
}

// Inserts one completed session row. week_number/phase are resolved from
// dayNumber via the shared curriculum (curriculum.ts); technique is
// whatever the caller (TechniquePicker's selection) passed in — not
// re-derived, since a day can have more than one unlocked technique.
export async function saveProgram40Session(input: SaveProgram40SessionInput): Promise<{ data: Program40Session | null; error: string | null }> {
  const { data, error } = await supabase
    .from('program_40_day_sessions')
    .insert({
      user_id: input.userId,
      session_date: todayLocalISODate(),
      day_number: input.dayNumber,
      week_number: getWeekForDay(input.dayNumber),
      phase: getPhaseForDay(input.dayNumber),
      technique: input.technique,
      device_used: input.deviceUsed,
      duration_seconds: Math.round(input.durationSeconds),
      hrv_score: input.hrvScore ?? null,
      self_rating: input.selfRating ?? null,
      notes: input.notes ?? null,
    })
    .select('id, user_id, session_date, day_number, week_number, phase, technique, device_used, duration_seconds, hrv_score, self_rating, notes, created_at')
    .single()

  if (error) {
    console.error('[program40/sessions] insert failed:', error.message)
    return { data: null, error: error.message }
  }
  return { data: fromRow(data), error: null }
}

// Current consecutive-day streak, combined across device-used and
// no-device sessions (spec item 4: streak is NOT split per tab, only the
// history list is). Counts back from the most recent session date; a gap of
// more than one calendar day anywhere in that walk stops the count. If the
// most recent session isn't today or yesterday, the streak reads as broken
// (0) even though distinct-day progress (current_day) itself is never lost
// — this is the same "progress persists, streak resets" split most habit
// trackers use, and matches spec item 5's intent that a missed day has no
// punitive UI beyond the motivational streak number itself.
export function computeStreak(sessionDates: string[]): number {
  const uniqueDesc = Array.from(new Set(sessionDates)).sort((a, b) => (a < b ? 1 : -1))
  if (uniqueDesc.length === 0) return 0

  const today = todayLocalISODate()
  const yesterday = addDaysISODate(today, -1)
  if (uniqueDesc[0] !== today && uniqueDesc[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDesc.length; i++) {
    const expectedPrevDay = addDaysISODate(uniqueDesc[i - 1], -1)
    if (uniqueDesc[i] === expectedPrevDay) streak++
    else break
  }
  return streak
}
