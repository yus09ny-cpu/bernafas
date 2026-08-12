import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

// Generic destructive-action gate — a full-screen dimmed backdrop + centered
// card, not a Popover (Popover/popover.tsx is for anchored, low-stakes
// pickers like SmoothnessSetting; a delete confirmation needs to block the
// whole screen and force an explicit choice, not sit in a corner next to a
// trigger). First use: History's "delete session" action
// (HistoryDetail.tsx) — kept here rather than local to that screen since
// any future destructive action (delete account, clear scene image, etc.)
// can reuse it as-is.
//
// Backdrop click cancels (same escape hatch as tapping outside a native
// confirm), but the card itself stops that click from bubbling so tapping
// the card doesn't dismiss it. No Escape-key handler — this app has no
// other keyboard-driven surface to match, and the two on-screen buttons are
// already the full set of ways out.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Sahkan',
  cancelLabel = 'Batal',
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <p id="confirm-dialog-title" className="text-sm font-semibold text-[var(--color-text)]">
          {title}
        </p>
        {description && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>}
        {error && <p className="mt-2 text-xs text-[var(--color-destructive)]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-black/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
              destructive ? 'bg-[var(--color-destructive)] hover:opacity-90' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]',
            )}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
