import PulseWaveform from '@/components/session/PulseWaveform'
import PulseDot from '@/components/session/PulseDot'
import SceneBackground from '@/components/session/SceneBackground'
import { getCoherenceZone } from '@/lib/coherenceZones'
import type { LiveSessionData } from './types'

// Skrin 2 — same waveform strip + dot as Skrin 1, no ring, over a full-bleed
// calming background instead. Deliberately the most stripped-down page: no
// numbers, no labels, just the breathing/pulse visual over the scene.
export default function Page2Scene({ data }: { data: LiveSessionData }) {
  const zone = data.coherenceLive !== null ? getCoherenceZone(data.coherenceLive) : null

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between px-6">
      <SceneBackground />
      <div style={{ paddingTop: 'calc(4.5rem + var(--safe-top))' }} className="w-full">
        <PulseWaveform bpm={data.bpm} color="#ffffff" className="max-w-sm" />
      </div>

      <PulseDot phase={data.phase} phaseDurationMs={data.phaseDurationMs} bpm={data.bpm} zone={zone} size={150} />

      <span
        className="text-xs font-medium text-white"
        style={{ paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}
      >
        Nafas ke-{data.cycleCount + 1}
      </span>
    </div>
  )
}
