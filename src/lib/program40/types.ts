import type { Program40Phase, Program40Technique } from '@/lib/program40/curriculum'

export type Program40Status = 'active' | 'completed' | 'paused'

// The 3-preset post-session pulse-check, ported from Mod Hamba's
// (madrasah-iam) MOD_HAMBA_REFLECTION_OPTIONS pattern — only ever populated
// for a no-device session (see program_40_day_sessions.self_rating's check
// constraint / SelfRatingPreset.tsx).
export type Program40SelfRating = 'tenang' | 'biasa' | 'resah'

export interface Program40Enrollment {
  userId: string
  startDate: string // date, "YYYY-MM-DD"
  currentDay: number // cached derived value — see curriculum.ts's header comment
  status: Program40Status
  createdAt: string
}

export interface Program40Session {
  id: string
  userId: string
  sessionDate: string // date, "YYYY-MM-DD"
  dayNumber: number
  weekNumber: number
  phase: Program40Phase
  technique: Program40Technique
  deviceUsed: boolean
  durationSeconds: number
  hrvScore: number | null // populated only when deviceUsed
  selfRating: Program40SelfRating | null // populated only when !deviceUsed
  notes: string | null
  createdAt: string
}
