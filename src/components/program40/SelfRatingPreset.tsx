import { cn } from '@/lib/utils'
import type { Program40SelfRating } from '@/lib/program40/types'

interface SelfRatingPresetProps {
  value: Program40SelfRating | null
  onChange: (value: Program40SelfRating) => void
}

// Ported from Mod Hamba's post-session pulse-check (madrasah-iam,
// ZikirKhafiPlayer.tsx's MOD_HAMBA_REFLECTION_OPTIONS) — 3 preset buttons,
// not free text, for the same reason it was chosen there: a low-friction
// check right after a session, not a deep journal entry (that's Jurnal's
// job). Restyled to Bernafas' own pastel teal palette instead of Mod
// Hamba's purple #a78bfa — that purple is madrasah-iam's own Zikir Khafi
// brand color, not something to carry across into a zero-spiritual-branding
// app (see project-bernafas memory's hard rule).
const OPTIONS: Array<{ value: Program40SelfRating; label: string }> = [
  { value: 'tenang', label: 'Tenang' },
  { value: 'biasa', label: 'Biasa' },
  { value: 'resah', label: 'Masih Resah' },
]

export default function SelfRatingPreset({ value, onChange }: SelfRatingPresetProps) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Bagaimana rasa hati anda sekarang?">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-xl border py-2.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
