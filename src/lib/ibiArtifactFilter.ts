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
// 2026-08 investigation history (why this is a two-tier filter, not one
// flat threshold):
//
// 1. The original design compared each new IBI to a flat 20% band around
//    the single last ACCEPTED value. Production telemetry showed that
//    threshold rejecting the vast majority of real beats (110+ rejections
//    against single-digit/dozens of accepted samples over a multi-minute
//    session) — starving the segmented ring, Skrin 1's HrvGraph, and (most
//    recently) calibration itself, which needs 20 accepted beats and was
//    taking 139.7s in a real session instead of the expected ~20-30s.
// 2. A phase-correlation test (cross-referencing rejection timing against
//    the paced-breathing pacer, testing whether rejections cluster at
//    inhale<->exhale transitions — the signature of genuine RSA rather than
//    sensor jitter) came back negative: rejection timing was statistically
//    indistinguishable from uniform across the breath cycle.
// 3. That same real session's log caught the single-last-accepted design's
//    actual failure mode directly: one spurious ~137bpm accepted sample
//    (439ms) became the comparison baseline and then never updated again —
//    18+ consecutive real beats at the person's genuine ~50-80bpm resting
//    rate all got rejected as "too far" from that one bad sample, because
//    nothing at a normal rate can land within any reasonable percentage of
//    a baseline stuck way up at 137bpm. The baseline doesn't just get
//    dragged around by noise (the original theory) — a single bad accepted
//    sample can poison it for the rest of the session with no self-recovery.
//
// Fix: a rolling median of the last several accepted IBIs replaces the
// single last-accepted value as the comparison baseline. A median is
// resistant to exactly this failure mode — one outlier entering the window
// shifts the median only slightly (or not at all, depending on window
// position), instead of becoming the entire reference point outright. Two
// independent thresholds sit on top of that shared baseline: a moderate,
// tunable one (this file's constant) for everyday jitter, and a hard,
// non-configurable ceiling + dropped-beat-multiple check for genuine
// artifacts, so retuning the moderate knob can never accidentally disable
// the safety net.

import { reportRejectedBeat } from './ibiRejectionDebugBus'

// Moderate threshold against the rolling-median baseline. 40% is a starting
// point informed by a real distribution pull of rejected-vs-accepted IBI
// pairs (median rejected jump was ~35%, most of the moderate range fell
// between 20-45%) — re-tune from real session data if it's still too
// strict/loose, same as before.
export const DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT = 0.4

// Hard, non-configurable ceiling — no constructor override, specifically so
// raising DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT (or a custom threshold) can
// never disable the dropped-beat safety net below.
const EXTREME_IBI_ARTIFACT_THRESHOLD_PCT = 0.8

// How many recent accepted IBIs the rolling-median baseline is computed
// over. 5-7 is enough to resist one outlier entering the window from
// becoming (most of) the median, while still tracking a genuine sustained
// heart-rate change within a few beats.
const BASELINE_WINDOW = 6

// A dropped beat is reported as one long interval spanning roughly N true
// beats (N = 2, 3, ...) — its ratio to the true rhythm lands close to a
// whole number. This band (±15% of the integer) catches that pattern even
// when the resulting pctChange is a bit under EXTREME_IBI_ARTIFACT_THRESHOLD_PCT.
// Checked both directions (ibi as a multiple of baseline, and baseline as a
// multiple of ibi) since a spuriously split beat looks like the reverse
// pattern.
const MULTIPLE_ARTIFACT_TOLERANCE_PCT = 0.15
const CHECKED_MULTIPLES = [2, 3, 4]

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function isNearIntegerMultiple(a: number, b: number): boolean {
  const ratio = a / b
  return CHECKED_MULTIPLES.some(n => Math.abs(ratio - n) / n <= MULTIPLE_ARTIFACT_TOLERANCE_PCT || Math.abs(1 / ratio - n) / n <= MULTIPLE_ARTIFACT_TOLERANCE_PCT)
}

export class IbiArtifactFilter {
  // Most-recent-last, capped at BASELINE_WINDOW.
  private acceptedHistory: number[] = []

  constructor(private thresholdPct: number = DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT) {}

  // Returns the IBI if accepted, or null if rejected as an artifact — callers
  // should skip null results entirely (not push them, not smooth them, not
  // feed them to computeCoherence). The first IBI of a session has nothing
  // to compare against yet, so it's always accepted and becomes the seed of
  // the rolling baseline for the next one.
  accept(ibiMs: number): number | null {
    if (this.acceptedHistory.length === 0) {
      this.acceptedHistory.push(ibiMs)
      return ibiMs
    }

    const baseline = median(this.acceptedHistory)
    const pctChange = Math.abs(ibiMs - baseline) / baseline

    if (pctChange > EXTREME_IBI_ARTIFACT_THRESHOLD_PCT || isNearIntegerMultiple(ibiMs, baseline)) {
      reportRejectedBeat(ibiMs, baseline, pctChange)
      return null
    }
    if (pctChange > this.thresholdPct) {
      reportRejectedBeat(ibiMs, baseline, pctChange)
      return null
    }

    this.acceptedHistory.push(ibiMs)
    if (this.acceptedHistory.length > BASELINE_WINDOW) this.acceptedHistory.shift()
    return ibiMs
  }

  // Call at the start of each new session — without this, the first IBI of
  // a fresh session would be compared against the rolling baseline from
  // whatever session ran before it (or a mid-session BLE reconnect gap),
  // which is neither continuous with nor comparable to the new stream.
  reset(): void {
    this.acceptedHistory = []
  }
}
