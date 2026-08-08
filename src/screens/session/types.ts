import type { BreathPhase } from '@/hooks/useBreathingPacer'
import type { HistoryPoint } from '@/lib/sessionStats'

// One bundle of the live session stream, shared by all four carousel pages
// — each page is a different *view* of this same data, never a separate
// fetch. Built once in SessionCarousel from useHrvSession() + useBreathingPacer().
export interface LiveSessionData {
  bpm: number | null // smoothedBpm — keeps updating even after the session ends
  coherenceLive: number | null
  history: HistoryPoint[]
  elapsedSec: number
  contactLost: boolean
  isDeviceConnected: boolean
  sessionActive: boolean
  phase: BreathPhase
  phaseDurationMs: number
  cycleCount: number
  showUnlockBonus: boolean
}
