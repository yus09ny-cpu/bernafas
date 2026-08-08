import type { ReactNode } from 'react'

interface PlaceholderScreenProps {
  icon: ReactNode
  title: string
  description: string
}

// Shared "akan datang" shell for the three nav tabs this brief didn't ask
// to be built out yet (Review/Journal/Guides/NafasCloud) — keeps the shell
// fully navigable without faking content for screens that have no spec yet.
export default function PlaceholderScreen({ icon, title, description }: PlaceholderScreenProps) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
      style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-[var(--color-primary)]">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-[var(--color-primary-dark)]">{title}</span>
        <span className="max-w-xs text-sm text-[var(--color-text-muted)]">{description}</span>
      </div>
      <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
        Akan datang
      </span>
    </div>
  )
}
