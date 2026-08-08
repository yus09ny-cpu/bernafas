import type { HrvDebugStats } from '@/hooks/useHrvSession'

interface DebugOverlayProps {
  stats: HrvDebugStats
  historyLength: number
  elapsedSec: number
}

// TEMP DEBUG — remove once Issue 2 (ring not showing zone progression on
// real hardware) is diagnosed. Always-on (not gated behind import.meta.env.DEV)
// because the point is to read these numbers off the deployed bernafas.my
// site during a real BLE test session, not a local dev build. Surfaces the
// three rejection/skip counters from useHrvSession's debugStats, plus
// history.length and elapsedSec directly — a session that showed zero
// colored ring segments needs "did history ever grow at all" answered on
// its own, not just inferred from how it compares to the three counters.
export default function DebugOverlay({ stats, historyLength, elapsedSec }: DebugOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute left-3 z-40 rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-white"
      style={{ bottom: 'calc(var(--nav-height) + 0.75rem + var(--safe-bottom))' }}
    >
      <div>elapsedSec: {elapsedSec}</div>
      <div>history.length: {historyLength}</div>
      <div>contact lost: {stats.contactLostFlips}</div>
      <div>beats rejected: {stats.rejectedBeats}</div>
      <div>sampler skipped: {stats.sparseGateSkips}</div>
    </div>
  )
}
