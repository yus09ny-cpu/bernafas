// TEMP DEBUG — external store PulseDot reports its actual live render values
// into, so DebugOverlay can display the *real* phase/breathScale PulseDot is
// computing on each of its own renders — not a recomputation elsewhere that
// could silently diverge, and not inferred from computed CSS style. Plain
// module-level store + useSyncExternalStore is the correct React pattern
// for "something outside a component's own tree needs to observe its
// render-time values live."
//
// renderCount is included deliberately: if PulseDot itself weren't
// re-rendering (or were receiving a stale phase prop while its sibling
// elements — e.g. the phase label rendered directly in Page1Ring — kept
// updating normally), phase/breathScale here would freeze while renderCount
// also stops climbing. That distinguishes "the value truly isn't changing"
// from "this component isn't re-rendering / getting fresh props at all."
export interface PulseDotDebugSnapshot {
  phase: string
  breathScale: number
  renderCount: number
}

let snapshot: PulseDotDebugSnapshot = { phase: '(none yet)', breathScale: NaN, renderCount: 0 }
const listeners = new Set<() => void>()

export function reportPulseDotRender(phase: string, breathScale: number): void {
  snapshot = { phase, breathScale, renderCount: snapshot.renderCount + 1 }
  listeners.forEach(l => l())
}

export function getPulseDotDebugSnapshot(): PulseDotDebugSnapshot {
  return snapshot
}

export function subscribePulseDotDebug(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
