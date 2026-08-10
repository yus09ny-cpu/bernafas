import type { Beat } from '@/lib/coherence'

// Types-only port of calm-breath-pulse's src/hooks/useHeartRateDevice.ts.
// The source repo's hook is its own second BLE connection; Bernafas already
// owns exactly one live GATT connection (useHeartRateMonitor, wired up once
// in useHrvSession.ts) and every carousel page shares that single stream —
// see the memory/architecture note in SessionScreen.tsx. Standing up a
// second connect() flow here would race the real one for the same strap.
// This file exists only so DeviceConnect.tsx (copied verbatim from the
// source repo) has the `HeartRateDevice` type it expects at this exact
// import path; the actual object is built from real data inside
// useHrvSession.ts and passed down as `data.device`.
export type DeviceStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'error'

export type HeartRateDevice = {
  status: DeviceStatus
  deviceName: string | null
  error: string | null
  bpm: number
  /** Rolling buffer of beats with RR intervals (ms) — real, artifact-filtered device data. */
  beats: Beat[]
  /** True once the device has sent at least one RR interval (required for real HRV). */
  hasRr: boolean
  connect: () => Promise<void>
  disconnect: () => void
}
