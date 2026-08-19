import { supabase } from '@/lib/supabase'
import { todayLocalISODate } from '@/lib/program40/date'
import { PROGRAM_40_DAY_TOTAL } from '@/lib/program40/curriculum'
import type { Program40Enrollment } from '@/lib/program40/types'

function fromRow(row: {
  user_id: string
  start_date: string
  current_day: number
  status: string
  created_at: string
}): Program40Enrollment {
  return {
    userId: row.user_id,
    startDate: row.start_date,
    currentDay: row.current_day,
    status: row.status as Program40Enrollment['status'],
    createdAt: row.created_at,
  }
}

// Program40Hub's read-only check on mount — null (not an error) if this
// user has never opened the module before. Deliberately never inserts:
// just landing on the Panduan tab shouldn't silently create a
// start_date-stamped enrollment row before the user has actually pressed
// "Mula Program 40 Hari" (createEnrollment, below).
export async function getEnrollment(userId: string): Promise<{ data: Program40Enrollment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('program_40_day_enrollment')
    .select('user_id, start_date, current_day, status, created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[program40/enrollment] select failed:', error.message)
    return { data: null, error: error.message }
  }
  return { data: data ? fromRow(data) : null, error: null }
}

// Program40Hub's "Mula Program 40 Hari" button — the one real enrollment
// write, start_date stamped as of right now. Safe to call again for an
// already-enrolled user (getEnrollment is always checked first by the only
// caller) but does NOT reset an existing row if it somehow is — upsert
// ignores duplicates rather than overwriting a real start_date/current_day.
export async function createEnrollment(userId: string): Promise<{ data: Program40Enrollment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('program_40_day_enrollment')
    .upsert({ user_id: userId, start_date: todayLocalISODate(), current_day: 0, status: 'active' }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('user_id, start_date, current_day, status, created_at')
    .maybeSingle()

  if (error) {
    console.error('[program40/enrollment] insert failed:', error.message)
    return { data: null, error: error.message }
  }
  // ignoreDuplicates:true returns no row on a conflict — re-select in that
  // case to still hand back the (untouched) existing enrollment.
  if (data) return { data: fromRow(data), error: null }
  return getEnrollment(userId)
}

// Called once right after a session save (sessions.ts's saveProgram40Session)
// — recomputes current_day as the count of DISTINCT session_date rows this
// user has a completed session on (spec item 5: never `today - start_date`,
// so a skipped day never rolls this backward), and flips status to
// 'completed' once all 40 distinct days are covered.
export async function recomputeEnrollmentProgress(userId: string): Promise<{ data: Program40Enrollment | null; error: string | null }> {
  const { data: rows, error: selectError } = await supabase
    .from('program_40_day_sessions')
    .select('session_date')
    .eq('user_id', userId)

  if (selectError) {
    console.error('[program40/enrollment] progress select failed:', selectError.message)
    return { data: null, error: selectError.message }
  }

  const distinctDays = new Set((rows ?? []).map(r => r.session_date as string)).size
  const currentDay = Math.min(PROGRAM_40_DAY_TOTAL, distinctDays)
  const status = currentDay >= PROGRAM_40_DAY_TOTAL ? 'completed' : 'active'

  const { data: updated, error: updateError } = await supabase
    .from('program_40_day_enrollment')
    .update({ current_day: currentDay, status })
    .eq('user_id', userId)
    .select('user_id, start_date, current_day, status, created_at')
    .single()

  if (updateError) {
    console.error('[program40/enrollment] update failed:', updateError.message)
    return { data: null, error: updateError.message }
  }
  return { data: fromRow(updated), error: null }
}
