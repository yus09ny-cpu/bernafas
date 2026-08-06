import { useState } from 'react'
import { X } from 'lucide-react'
import BreathOrb from '@/components/BreathOrb'
import CoherenceRing from '@/components/CoherenceRing'
import { useBreathingPacer } from '@/hooks/useBreathingPacer'

// This is Screens 2 + 3 from the project brief combined into one continuous
// session view — the pacer and the live HRV score both run for the same
// duration off the same session, so splitting them into separate screens
// would mean either duplicating the timer or forcing an awkward mid-session
// navigation. The score stays small/secondary; the orb is still the
// dominant visual (this is the screen that matters most for the TikTok demo).
interface BreathingScreenProps {
  bpm: number | null
  coherenceLive: number | null
  isDeviceConnected: boolean
  onEnd: (breathCount: number) => void
}

const INHALE_MS = 5000
const EXHALE_MS = 5000

const PHASE_LABEL: Record<'in' | 'out', string> = {
  in: 'Tarik Nafas',
  out: 'Hembus Nafas',
}

export default function BreathingScreen({ bpm, coherenceLive, isDeviceConnected, onEnd }: BreathingScreenProps) {
  const [running] = useState(true)
  const { phase, cycleCount } = useBreathingPacer({ inhaleMs: INHALE_MS, exhaleMs: EXHALE_MS, running })
  const phaseDurationMs = phase === 'in' ? INHALE_MS : EXHALE_MS

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-between px-6 py-8"
      style={{ paddingTop: 'calc(1.5rem + var(--safe-top))', paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
    >
      <div className="flex w-full items-center justify-between">
        {isDeviceConnected ? (
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[var(--color-primary-dark)]">
            {bpm !== null ? `${bpm} bpm` : 'menunggu bacaan...'}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => onEnd(cycleCount)}
          aria-label="Tamatkan sesi"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-[var(--color-text-muted)]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-8">
        <BreathOrb phase={phase} durationMs={phaseDurationMs} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold tracking-wide text-[var(--color-primary-dark)] transition-opacity duration-300">
            {PHASE_LABEL[phase]}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Ikut bulatan — kembang saat tarik, kecut saat hembus</span>
        </div>

        {isDeviceConnected && (
          coherenceLive !== null ? (
            <CoherenceRing value={coherenceLive} size={88} label="SKOR LIVE" />
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">Mengumpul bacaan HRV...</span>
          )
        )}
      </div>

      <div className="flex flex-col items-center gap-1 text-[var(--color-text-muted)]">
        <span className="text-xs">Nafas ke-{cycleCount + 1}</span>
      </div>
    </div>
  )
}
