import { Gift } from 'lucide-react'

// Placeholder only — see src/lib/unlockBonus.ts for why the actual reveal
// content is intentionally not wired up yet.
export default function UnlockBonusCard() {
  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-2xl bg-white/70 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-warm)]/20 text-[var(--color-warm)]">
        <Gift size={20} />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold text-[var(--color-text)]">Ganjaran istimewa dibuka</span>
        <span className="text-xs text-[var(--color-text-muted)]">Akan tersedia tidak lama lagi</span>
      </div>
    </div>
  )
}
