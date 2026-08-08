import { useSyncExternalStore } from 'react'
import type { HrvDebugStats } from '@/hooks/useHrvSession'
import { getPulseDotDebugSnapshot, subscribePulseDotDebug } from '@/lib/pulseDotDebugBus' // TEMP DEBUG

interface DebugOverlayProps {
  stats: HrvDebugStats
  historyLength: number
  elapsedSec: number
}

// TEMP DEBUG — remove once Issue 2 (ring not showing zone progression) and
// the PulseDot breath-scale investigation are both diagnosed. Always-on
// (not gated behind import.meta.env.DEV) because the point is to read these
// numbers off the deployed bernafas.my site during a real BLE test session,
// not a local dev build.
//
// phase/breathScale/renders come straight from PulseDot's own render via
// pulseDotDebugBus (see that file) — the actual runtime values PulseDot
// itself computed, not a value recomputed elsewhere that could silently
// diverge. `renders` climbing confirms PulseDot is re-rendering at all; if
// it stalls while the phase label elsewhere keeps alternating, that alone
// would show PulseDot is the one not getting fresh renders/props.
export default function DebugOverlay({ stats, historyLength, elapsedSec }: DebugOverlayProps) {
  const dotDebug = useSyncExternalStore(subscribePulseDotDebug, getPulseDotDebugSnapshot)

  return (
    <div
      className="pointer-events-none absolute left-3 z-40 rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-white"
      style={{ bottom: 'calc(var(--nav-height) + 0.75rem + var(--safe-bottom))' }}
    >
      <div>phase: {dotDebug.phase}</div>
      <div>breathScale: {dotDebug.breathScale}</div>
      <div>dot renders: {dotDebug.renderCount}</div>
      <div>elapsedSec: {elapsedSec}</div>
      <div>history.length: {historyLength}</div>
      <div>contact lost: {stats.contactLostFlips}</div>
      <div>beats rejected: {stats.rejectedBeats}</div>
      <div>sampler skipped: {stats.sparseGateSkips}</div>
    </div>
  )
}
