import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TECHNIQUE_META, type Program40Technique } from '@/lib/program40/curriculum'

interface TechniquePickerProps {
  available: Program40Technique[]
  value: Program40Technique
  onChange: (technique: Program40Technique) => void
  onContinue: () => void
}

// Program40SessionScreen's first real step, before DeviceChoicePopup — the
// user picks which of the day's cumulatively-unlocked techniques (see
// curriculum.ts's getAvailableTechniquesForDay) this particular sitting is
// for. Only ever lists what's actually unlocked for the day — a fondasi-day
// user never sees kunci_hati as an option at all, not a greyed-out locked
// tile (nothing in the brief asked for a locked-state visual).
export default function TechniquePicker({ available, value, onChange, onContinue }: TechniquePickerProps) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-[var(--color-primary-dark)]">Pilih teknik</span>
        <span className="max-w-xs text-sm text-[var(--color-text-muted)]">Teknik mana untuk sesi kali ini?</span>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2" role="radiogroup" aria-label="Pilih teknik">
        {available.map(technique => (
          <button
            key={technique}
            type="button"
            role="radio"
            aria-checked={value === technique}
            onClick={() => onChange(technique)}
            className={cn(
              'rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors',
              value === technique
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]'
                : 'border-[var(--color-border)] bg-white/70 text-[var(--color-text)]',
            )}
          >
            {TECHNIQUE_META[technique].label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
      >
        Teruskan <ArrowRight size={18} />
      </button>
    </div>
  )
}
