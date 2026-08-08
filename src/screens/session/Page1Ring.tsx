import PulseWaveform from '@/components/session/PulseWaveform'
import PulseDot from '@/components/session/PulseDot'
import SegmentedCoherenceRing from '@/components/session/SegmentedCoherenceRing'
import { getCoherenceZone, ZONE_COLOR } from '@/lib/coherenceZones'
import type { LiveSessionData } from './types'

const PHASE_LABEL: Record<'in' | 'out', string> = {
  in: 'Tarik Nafas',
  out: 'Hembus Nafas',
}

// Skrin 1 — the default landing page of the session carousel. Waveform
// strip, a breath+pulse-synced dot, and the segmented coherence ring
// wrapped around it.
export default function Page1Ring({ data }: { data: LiveSessionData }) {
  const zone = data.coherenceLive !== null ? getCoherenceZone(data.coherenceLive) : null

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-6"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <PulseWaveform bpm={data.bpm} color={zone ? ZONE_COLOR[zone] : '#3e9c9c'} className="max-w-sm" />

      <div className="flex flex-col items-center gap-6">
        <SegmentedCoherenceRing history={data.history} elapsedSec={data.elapsedSec} size={260}>
          <PulseDot phase={data.phase} phaseDurationMs={data.phaseDurationMs} bpm={data.bpm} zone={zone} size={130} />
        </SegmentedCoherenceRing>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold tracking-wide text-[var(--color-primary-dark)]">
            {PHASE_LABEL[data.phase]}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.contactLost
              ? 'Tiada bacaan — letak jari pada sensor'
              : data.coherenceLive !== null
              ? `Skor live: ${Math.round(data.coherenceLive * 100)}`
              : data.isDeviceConnected
              ? 'Mengumpul bacaan HRV...'
              : 'Ikut bulatan — kembang saat tarik, kecut saat hembus'}
          </span>
        </div>
      </div>

      <span className="text-xs text-[var(--color-text-muted)]">Nafas ke-{data.cycleCount + 1}</span>
    </div>
  )
}
