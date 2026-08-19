import { Clock } from 'lucide-react'
import { DAILY_SCHEDULE } from '@/lib/program40/dailySchedule'
import { TECHNIQUE_META, type Program40Phase } from '@/lib/program40/curriculum'

interface JadualHarianCardProps {
  phase: Program40Phase
}

// Bab 13's Jadual Harian, for the user's CURRENT phase only — reads
// DAILY_SCHEDULE (dailySchedule.ts), the same data TechniquePicker's
// suggestTechniqueForNow() reads, so this card and that suggestion can
// never quietly disagree with each other.
export default function JadualHarianCard({ phase }: JadualHarianCardProps) {
  const entries = DAILY_SCHEDULE[phase]

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={16} className="text-[var(--color-primary)]" />
        <span className="text-sm font-semibold text-[var(--color-text)]">Jadual Harian</span>
      </div>
      <div className="flex flex-col gap-3">
        {entries.map(entry => (
          <div key={entry.slot} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-primary-dark)]">{entry.label}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{entry.durationLabel}</span>
            </div>
            <span className="text-xs text-[var(--color-text)]">
              {entry.techniques.map(t => TECHNIQUE_META[t].label).join(' + ')}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">{entry.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
