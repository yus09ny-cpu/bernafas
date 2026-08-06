// ─── IBI artifact rejection ────────────────────────────────────────────────
// Beat-detection timing jitter (small per-beat timing noise from the
// MAX30102 PPG sensor/ESP32 firmware) gets amplified by RMSSD's
// difference-of-differences math — a single noisy IBI can inflate RMSSD (and
// therefore computeCoherence()'s score) far more than the same noise would
// affect a plain average. Live testing showed exactly this: unrealistically
// high scores traced back to jitter, not genuine physiological variability.
// This filter rejects a bad IBI before it ever reaches computeCoherence(),
// rather than trying to make the RMSSD math itself tolerate dirty input.
//
// Approach: percentage-change-from-last-ACCEPTED-value thresholding — a
// simplified version of the successive-difference artifact-correction
// methods used in HRV toolkits (e.g. Kubios HRV's percentage-based
// correction levels). Comparing against the last *accepted* value (not the
// raw previous sample, which may itself have been rejected) means one bad
// beat can't cascade into rejecting every beat after it — a genuine,
// sustained heart-rate change still gets through, just not a single-sample
// spike.
//
// Default 20% is a starting point, not yet empirically tuned against
// Bernafas's own session data — see DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT.
// Re-tune this constant (not the class logic) if real sessions show it's
// too strict (rejecting genuine fast heart-rate changes) or too loose
// (still letting jitter spikes through).

export const DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT = 0.2

export class IbiArtifactFilter {
  private lastAccepted: number | null = null

  constructor(private thresholdPct: number = DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT) {}

  // Returns the IBI if accepted, or null if rejected as an artifact — callers
  // should skip null results entirely (not push them, not smooth them, not
  // feed them to computeCoherence). The first IBI of a session has nothing
  // to compare against yet, so it's always accepted and becomes the
  // baseline for the next one.
  accept(ibiMs: number): number | null {
    if (this.lastAccepted === null) {
      this.lastAccepted = ibiMs
      return ibiMs
    }
    const pctChange = Math.abs(ibiMs - this.lastAccepted) / this.lastAccepted
    if (pctChange > this.thresholdPct) return null
    this.lastAccepted = ibiMs
    return ibiMs
  }

  // Call at the start of each new session — without this, the first IBI of
  // a fresh session would be compared against the last accepted IBI from
  // whatever session ran before it (or a mid-session BLE reconnect gap),
  // which is neither continuous with nor comparable to the new stream.
  reset(): void {
    this.lastAccepted = null
  }
}
