// TEMP DEBUG — investigating why the segmented ring stays mostly gray on
// real hardware: `beats rejected` telemetry showed IbiArtifactFilter
// rejecting the vast majority of real beats (110+ rejections against
// history.length in the single digits/dozens over a multi-minute session),
// starving `history` of samples. This surfaces the *actual* rejected-vs-
// accepted IBI pair for every rejection, so it's possible to tell whether
// real fingertip sensor noise is genuinely that erratic or the current 20%
// threshold (DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT in ibiArtifactFilter.ts) is
// simply too strict for real-world signal — without changing that threshold
// yet. Every rejection logs to console (full trail, e.g. via chrome://inspect
// remote debugging); getLatestRejection/subscribeRejectedBeats expose the
// same data for an on-screen readout if one gets wired up again later —
// unconsumed for now (the debug overlay that used them was removed once the
// PulseDot investigation closed), left in place since this investigation
// is still open. Still TEMP — remove once the threshold question is settled.
export interface RejectedBeat {
  ibiMs: number
  lastAccepted: number
  pctChange: number // 0-1
}

let latest: RejectedBeat | null = null
let totalCount = 0
const listeners = new Set<() => void>()

export function reportRejectedBeat(ibiMs: number, lastAccepted: number, pctChange: number): void {
  latest = { ibiMs: Math.round(ibiMs), lastAccepted: Math.round(lastAccepted), pctChange }
  totalCount++
  console.log('[IbiArtifactFilter] TEMP DEBUG rejected beat', {
    ibiMs: latest.ibiMs,
    lastAccepted: latest.lastAccepted,
    pctChange: `${(pctChange * 100).toFixed(1)}%`,
    totalRejectedThisPage: totalCount,
  })
  listeners.forEach(l => l())
}

export function getLatestRejection(): RejectedBeat | null {
  return latest
}

export function subscribeRejectedBeats(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
