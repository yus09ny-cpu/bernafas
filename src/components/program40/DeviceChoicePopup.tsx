import { Bluetooth, Timer, X } from 'lucide-react'

interface DeviceChoicePopupProps {
  open: boolean
  onChooseDevice: () => void
  onChooseManual: () => void
  onCancel: () => void
}

// Spec item 2 — shown every time a new session starts inside the 40-day
// module (Program40SessionScreen mounts into this as its first step, every
// time, not just for a first-ever session). Same full-screen dim-backdrop
// shell as ConfirmDialog.tsx, but two equally-weighted choice buttons
// instead of confirm/cancel — neither path is the "destructive" one here.
export default function DeviceChoicePopup({ open, onChooseDevice, onChooseManual, onCancel }: DeviceChoicePopupProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-choice-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <p id="device-choice-title" className="text-base font-bold text-[var(--color-text)]">
            Sesi hari ini
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup"
            className="rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">Nak sambung peranti HRV, atau latih dengan pemasa sahaja?</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onChooseDevice}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/8 px-4 py-3.5 text-left transition-colors active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
              <Bluetooth size={18} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">Sambung Peranti</span>
              <span className="text-xs text-[var(--color-text-muted)]">Skor HRV langsung semasa sesi</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseManual}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3.5 text-left transition-colors active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-accent)]">
              <Timer size={18} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-text)]">Latih Tanpa Peranti</span>
              <span className="text-xs text-[var(--color-text-muted)]">Pemasa sahaja, tiada Bluetooth</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
