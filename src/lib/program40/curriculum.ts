// Fixed day -> week/phase mapping for the 40-day program, plus which of the
// 5 techniques are unlocked at a given day — the single source every screen
// (Dashboard's calendar, the technique picker, sessions.ts's save call)
// reads from.
//
// week_number/phase per spec item 6: 1-14 = fondasi (minggu 1-2),
// 15-28 = pendalaman (minggu 3-4), 29-40 = integrasi (minggu 5-6).
//
// technique availability per the book's Bab 13 Jadual Harian (user
// correction, 2026-08-19) — CUMULATIVE unlock by phase, not one technique
// per week and not a replacement sequence: fondasi unlocks nafas_jantung +
// koheren_pantas; pendalaman ADDS nafas_sikap + beku_tanya on top (the
// fondasi pair stays active, never swapped out); integrasi ADDS kunci_hati,
// all 5 available at once. A session logs exactly ONE technique (whichever
// the user picks for that particular sitting via TechniquePicker.tsx), not
// a schedule Bernafas assigns automatically.

import { DAILY_SCHEDULE, getSlotForHour } from '@/lib/program40/dailySchedule'

export type Program40Phase = 'fondasi' | 'pendalaman' | 'integrasi'

export type Program40Technique =
  | 'nafas_jantung'
  | 'koheren_pantas'
  | 'nafas_sikap'
  | 'beku_tanya'
  | 'kunci_hati'

export const PROGRAM_40_DAY_TOTAL = 40

export function getWeekForDay(day: number): number {
  return Math.min(6, Math.max(1, Math.ceil(day / 7)))
}

export function getPhaseForDay(day: number): Program40Phase {
  if (day <= 14) return 'fondasi'
  if (day <= 28) return 'pendalaman'
  return 'integrasi'
}

export const PHASE_META: Record<Program40Phase, { label: string; weekRangeLabel: string }> = {
  fondasi: { label: 'Fondasi', weekRangeLabel: 'Minggu 1-2' },
  pendalaman: { label: 'Pendalaman', weekRangeLabel: 'Minggu 3-4' },
  integrasi: { label: 'Integrasi', weekRangeLabel: 'Minggu 5-6' },
}

export const TECHNIQUE_META: Record<Program40Technique, { label: string }> = {
  nafas_jantung: { label: 'Nafas Jantung' },
  koheren_pantas: { label: 'Koheren Pantas' },
  nafas_sikap: { label: 'Nafas Sikap' },
  beku_tanya: { label: 'Beku & Tanya' },
  kunci_hati: { label: 'Kunci Hati' },
}

const FONDASI_TECHNIQUES: Program40Technique[] = ['nafas_jantung', 'koheren_pantas']
const PENDALAMAN_ADDS: Program40Technique[] = ['nafas_sikap', 'beku_tanya']
const INTEGRASI_ADDS: Program40Technique[] = ['kunci_hati']

// Cumulative list of techniques unlocked as of this day — never shrinks as
// the phase advances, only grows. Order is display order (TechniquePicker
// renders in this order), not a priority ranking.
export function getAvailableTechniquesForDay(day: number): Program40Technique[] {
  const phase = getPhaseForDay(day)
  if (phase === 'fondasi') return [...FONDASI_TECHNIQUES]
  if (phase === 'pendalaman') return [...FONDASI_TECHNIQUES, ...PENDALAMAN_ADDS]
  return [...FONDASI_TECHNIQUES, ...PENDALAMAN_ADDS, ...INTEGRASI_ADDS]
}

// A sensible pre-selected default for TechniquePicker/Program40Hub's
// preview — NOT a hard schedule the app enforces; the user can always
// override the picker's selection. Reads DAILY_SCHEDULE (dailySchedule.ts,
// Bab 13's Jadual Harian) rather than its own separate time-of-day rule, so
// this suggestion and JadualHarianCard's displayed schedule can never drift
// apart into two different sources of truth. `hour` is injectable for
// tests/previews, defaults to the real local hour.
export function suggestTechniqueForNow(day: number, hour: number = new Date().getHours()): Program40Technique {
  const available = getAvailableTechniquesForDay(day)
  const phase = getPhaseForDay(day)
  const slot = getSlotForHour(hour)
  const entry = DAILY_SCHEDULE[phase].find(e => e.slot === slot)
  // entry's own technique list is only ever a subset of what's already
  // unlocked for this phase (kept consistent by hand in dailySchedule.ts),
  // but fall back to the first available technique defensively rather than
  // trust that invariant blindly.
  const scheduled = entry?.techniques.find(t => available.includes(t))
  return scheduled ?? available[0]
}
