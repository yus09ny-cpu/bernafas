// ---------------------------------------------------------------------------
// Reused verbatim from the Audit Jiwa codebase (src/lib/hrvCoherence.ts) —
// same HRV/RMSSD math, same backend logic, different front-end. Keep this
// file in sync with the source of truth there rather than re-deriving the
// formula independently if it ever changes.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// computeRmssdMs — raw RMSSD in ms (not normalized), for saved session rows
// ---------------------------------------------------------------------------
export function computeRmssdMs(intervalsMs: number[]): number {
  if (intervalsMs.length < 2) return 0
  let sq = 0
  for (let i = 1; i < intervalsMs.length; i++) {
    const d = intervalsMs[i] - intervalsMs[i - 1]
    sq += d * d
  }
  return Math.sqrt(sq / (intervalsMs.length - 1))
}

// ---------------------------------------------------------------------------
// computeCoherence — ln(RMSSD)-derived HRV score, 0 (low) → 1 (high)
//
// The natural-log transform of RMSSD is standard practice in the HRV
// literature because RMSSD is not normally distributed across a population
// (roughly log-normal) — see Esco & Flatt (2014), "Ultra-Short-Term Heart
// Rate Variability Indexes at Rest and Post-Exercise in Athletes," which
// validates a 60-second lnRMSSD window as a reliable surrogate for the
// standard 5-minute RMSSD measurement; also Plews, Laursen, Kilding &
// Buchheit (2013), "Training Adaptation and Heart Rate Variability in Elite
// Endurance Athletes," which log-transforms rMSSD specifically to reduce
// bias from non-uniform error when tracking training adaptation.
//
// The specific "/6.5" scaling constant is NOT itself from a peer-reviewed
// source — it is Elite HRV's own disclosed, empirically-calibrated scale
// mapping a typical human ln(RMSSD) range of ~0–6.5 onto a 0–100 score. It is
// a product calibration, not a universal scientific derivation — be upfront
// about that distinction if this number is discussed publicly.
//
// Callers must only pass genuinely measured intervals (device R-R or real
// tap timestamps) — a BPM-derived pseudo-interval has near-zero variance and
// will falsely collapse RMSSD toward 0.
// ---------------------------------------------------------------------------
export function computeCoherence(intervalsMs: number[]): number {
  const rmssd = computeRmssdMs(intervalsMs)
  if (rmssd <= 0) return 0
  return Math.max(0, Math.min(1, Math.log(rmssd) / 6.5))
}
