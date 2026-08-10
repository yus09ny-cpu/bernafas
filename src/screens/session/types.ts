import type { BreathPhase } from '@/hooks/useBreathingPacer'
import type { HistoryPoint } from '@/lib/sessionStats'
import type { Beat } from '@/lib/coherence'
import type { HeartRateDevice } from '@/hooks/useHeartRateDevice'
import type { SensorContactStatus } from '@/hooks/useHeartRateMonitor'

// One bundle of the live session stream, shared by all four carousel pages
// — each page is a different *view* of this same data, never a separate
// fetch. Built once in SessionCarousel from useHrvSession() + useBreathingPacer().
export interface LiveSessionData {
  bpm: number | null // smoothedBpm — keeps updating even after the session ends
  coherenceLive: number | null
  // Skrin-1-only A/B comparison against calm-breath-pulse's own coherence
  // formula, same real artifact-filtered beats — see useHrvSession.ts.
  // Never read by Skrin 2/3/4 or sessionStats.ts.
  coherenceLiveAlt: number | null
  history: HistoryPoint[]
  elapsedSec: number
  contactLost: boolean
  isDeviceConnected: boolean
  sessionActive: boolean
  phase: BreathPhase
  phaseDurationMs: number
  cycleCount: number
  showUnlockBonus: boolean
  // Real beat-to-beat tachogram + device connection view, added for Skrin 1's
  // calm-breath-pulse-derived components (HrvGraph, DeviceConnect). Same
  // single live BLE stream as everything else above — never fake data.
  beats: Beat[]
  device: HeartRateDevice
  simulated: boolean
  sensorContact: SensorContactStatus
  breathCount: number
}
