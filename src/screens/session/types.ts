import type { BreathPhase } from '@/hooks/useBreathingPacer'
import type { HistoryPoint } from '@/lib/sessionStats'
import type { Beat } from '@/lib/coherence'
import type { HeartRateDevice } from '@/hooks/useHeartRateDevice'
import type { SensorContactStatus } from '@/hooks/useHeartRateMonitor'
import type { Zone } from '@/components/session/SegmentedRing'

// One bundle of the live session stream, shared by all four carousel pages
// — each page is a different *view* of this same data, never a separate
// fetch. Built once in SessionScreen.tsx from useHrvSession() +
// useBreathingPacer() (+ useZoneDominance() for `zones`, see below).
export interface LiveSessionData {
  bpm: number | null // smoothedBpm — keeps updating even after the session ends
  coherenceLive: number | null
  // calm-breath-pulse's own frequency-domain coherence formula, same real
  // artifact-filtered beats — see useHrvSession.ts. Standardized as the
  // formula driving the ring/flower (Skrin 1, 2) and Skrin 4's
  // StatBar/CoherenceBandChart (via sessionStats.ts's coherenceAlt field).
  // coherenceLive (above) is still computed and still what Skrin 3's
  // PulseDot zone color reads — a distinct, deliberately-untouched call
  // site, not yet switched.
  coherenceLiveAlt: number | null
  // True once coherenceFromBeats has cleared its own ~20-30s/20-beat data
  // floor — see hasEnoughDataForCoherence in lib/coherence.ts. While false
  // (coherenceLiveAlt non-null but not yet a real reading), Skrin 1-3 show
  // "Mengkalibrasi…" instead of a phase label/score that would otherwise
  // read as a genuine (but actually floor-value) 0.
  coherenceAltReady: boolean
  // The single, shared zone-dominance tally (useZoneDominance, called once
  // in SessionScreen.tsx off coherenceLiveAlt) — Page1Ring and Page2Mandala
  // both read this SAME array, so their rings can never independently drift
  // the way two separate hook calls did before. Not yet extended to Skrin
  // 3's PulseDot (see coherenceLiveAlt's own comment above).
  zones: Zone[]
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
