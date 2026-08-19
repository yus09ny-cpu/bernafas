import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBreathingPacer } from '@/hooks/useBreathingPacer'
import BreathingPulse from '@/components/program40/BreathingPulse'
import RingWaves from '@/components/program40/RingWaves'
import { TECHNIQUE_STEPS } from '@/lib/program40/techniqueContent'
import type { Program40Technique } from '@/lib/program40/curriculum'

interface StepGuideProps {
  technique: Program40Technique
  inhaleMs: number
  exhaleMs: number
  // Fires with the COMBINED text of every requiresText step whenever any of
  // them changes (currently only Beku & Tanya's Akui/Bertindak) — the
  // caller (ManualSessionRunner) just holds the latest string and passes it
  // straight through to program_40_day_sessions.notes at save time.
  onNotesChange: (notes: string) => void
}

// Generic step-walker used for all 5 techniques — content comes from
// TECHNIQUE_STEPS (techniqueContent.ts), so this component itself has no
// technique-specific branching logic beyond reading each step's own
// showsPacer/requiresText flags. The breathing pacer (useBreathingPacer) is
// owned ONCE here and only runs while the current step wants it
// (`running: step.showsPacer`) — both BreathingPulse and RingWaves read the
// exact same phase/phaseDurationMs from this one hook call, never two
// independent instances that could drift apart (see useZoneDominance.ts's
// own doc comment on that exact failure mode elsewhere in this app).
export default function StepGuide({ technique, inhaleMs, exhaleMs, onNotesChange }: StepGuideProps) {
  const steps = TECHNIQUE_STEPS[technique]
  const [stepIndex, setStepIndex] = useState(0)
  const [stepTexts, setStepTexts] = useState<Record<string, string>>({})

  // A technique change (user picked a different one, or a fresh session
  // started) always resets to Langkah 1 — carrying over a stale mid-walk
  // index from a previous technique would land on an out-of-range or
  // wrong-content step.
  useEffect(() => {
    setStepIndex(0)
    setStepTexts({})
  }, [technique])

  const step = steps[Math.min(stepIndex, steps.length - 1)]

  const pacer = useBreathingPacer({ inhaleMs, exhaleMs, running: step.showsPacer ?? false })

  const updateStepText = (id: string, value: string) => {
    const next = { ...stepTexts, [id]: value }
    setStepTexts(next)
    // Joined in step order (not object key order) so a future re-render
    // with the same steps always produces the same combined string — same
    // "join labeled Q&A into one string" pattern AmalanPage.tsx's
    // REFLEKSI_SOALAN uses in madrasah-iam, ported here for Beku & Tanya's
    // Akui/Bertindak pair specifically.
    const combined = steps
      .filter(s => s.requiresText && next[s.id])
      .map(s => `${s.title}: ${next[s.id]}`)
      .join('\n\n')
    onNotesChange(combined)
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">
        Langkah {stepIndex + 1} / {steps.length}
      </span>

      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-lg font-bold text-[var(--color-primary-dark)]">{step.title}</h3>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">{step.description}</p>
      </div>

      {step.showsPacer && (
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          <RingWaves phase={pacer.phase} phaseDurationMs={pacer.phaseDurationMs} size={220} />
          <BreathingPulse phase={pacer.phase} phaseDurationMs={pacer.phaseDurationMs} size={110} />
        </div>
      )}

      {step.requiresText && (
        <textarea
          value={stepTexts[step.id] ?? ''}
          onChange={e => updateStepText(step.id, e.target.value)}
          placeholder={step.textPlaceholder}
          rows={4}
          className="w-full max-w-xs rounded-xl border border-[var(--color-border)] bg-white/80 p-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
        />
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setStepIndex(i => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          aria-label="Langkah sebelum"
          className="flex size-9 items-center justify-center rounded-full bg-white/70 text-[var(--color-text)] disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn('size-1.5 rounded-full', i === stepIndex ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]/30')}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStepIndex(i => Math.min(steps.length - 1, i + 1))}
          disabled={stepIndex === steps.length - 1}
          aria-label="Langkah seterusnya"
          className="flex size-9 items-center justify-center rounded-full bg-white/70 text-[var(--color-text)] disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
