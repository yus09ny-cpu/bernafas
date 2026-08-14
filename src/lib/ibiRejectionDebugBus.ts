// TEMP DEBUG — real-session telemetry for IbiArtifactFilter's reject path.
// Originally added to investigate the segmented ring staying gray (110+
// rejections against dozens of accepted samples), later used to catch the
// single-last-accepted baseline's poisoning failure mode directly in a real
// session log (see ibiArtifactFilter.ts's header comment) — the evidence
// that motivated the rolling-median-baseline fix. Kept in place post-fix so
// a real session's before/after rejection numbers can still be pulled
// straight from the console rather than re-added later. `baseline` (renamed
// from `lastAccepted`) is now the rolling median the rejected IBI was
// compared against, not a single prior sample.
//
// getLatestRejection/subscribeRejectedBeats and RejectedBeat's `t` timestamp
// used to exist for a phase-correlation cross-reference in SessionScreen.tsx
// (testing whether rejections cluster around breath-phase transitions —
// that test came back negative, see ibiArtifactFilter.ts). Removed once
// that investigation closed; reportRejectedBeat's console.log is the only
// consumer left.
let totalCount = 0

export function reportRejectedBeat(ibiMs: number, baseline: number, pctChange: number): void {
  totalCount++
  console.log('[IbiArtifactFilter] TEMP DEBUG rejected beat', {
    ibiMs: Math.round(ibiMs),
    baseline: Math.round(baseline),
    pctChange: `${(pctChange * 100).toFixed(1)}%`,
    totalRejectedThisPage: totalCount,
  })
}
