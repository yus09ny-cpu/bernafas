import type { ReactNode } from 'react'
import type { BreathPhase } from '@/hooks/useBreathingPacer'

const PHASE_LABEL: Record<BreathPhase, string> = {
  in: 'Tarik Nafas',
  out: 'Hembus Nafas',
}

interface BreathPhaseLabelProps {
  phase: BreathPhase
  // True while a device is connected and sending beats, but
  // coherenceFromBeats hasn't yet cleared its own ~20-30s/20-beat data
  // floor (see hasEnoughDataForCoherence, lib/coherence.ts /
  // data.coherenceAltReady). Shows "Mengkalibrasi…" in place of the phase
  // label + subtitle for that window, rather than a phase label sitting
  // above a score that's actually still the floor value.
  calibrating: boolean
  // Status line under the main label — page-specific (each page's own
  // device/contact/score state), not shown while calibrating.
  subtitle?: ReactNode
  // Skrin 3 sits over an arbitrary user photo — white text + shadow instead
  // of the brand teal used on Skrin 1/2's fixed light background.
  onDark?: boolean
}

// Shared breath-phase label — same "Tarik Nafas"/"Hembus Nafas" text, same
// calibration override, same position-in-flow convention (sits right under
// each page's ring/dot/flower) across Skrin 1, 2, and 3. Skrin 4 doesn't
// use this — it's the summary page, not a live breathing view.
export default function BreathPhaseLabel({ phase, calibrating, subtitle, onDark }: BreathPhaseLabelProps) {
  const textClass = onDark ? 'text-white' : 'text-[var(--color-primary-dark)]'
  const textStyle = onDark ? { textShadow: '0 1px 6px rgba(0,0,0,0.25)' } : undefined

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xl font-bold tracking-wide ${textClass}`} style={textStyle}>
        {calibrating ? 'Mengkalibrasi…' : PHASE_LABEL[phase]}
      </span>
      {!calibrating && subtitle}
    </div>
  )
}
