// Shared stat tile — extracted from StatBar (Skrin 4's Skor HRV/Tempoh/
// Pencapaian row) so Review's History detail view's own stat row reuses
// the exact same tile instead of a second copy that could drift.
export default function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-[var(--color-card-border)] bg-white/70 py-4 shadow-[var(--shadow-soft)]">
      <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      {sub && <span className="text-[11px] text-[var(--color-text-muted)]">{sub}</span>}
    </div>
  )
}
