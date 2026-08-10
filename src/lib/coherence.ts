// Ported from calm-breath-pulse's src/lib/coherence.ts. `Beat` was already
// here (needed for HrvGraph.tsx's import path). `bpmFromBeats` and
// `coherenceFromBeats` are now ALSO ported, verbatim, specifically to power
// a Skrin-1-only side-by-side comparison against Bernafas's own
// computeCoherence (hrvCoherence.ts) — see useHrvSession.ts's
// `coherenceLiveAlt`. This is deliberately NOT wired into Skrin 2/3/4 or
// sessionStats.ts, which still read only computeCoherence: the point of
// this file, for now, is to let the two formulas be watched live on the
// same real (artifact-filtered) beat stream to see how much of the
// red-never-showing gap is the formula itself vs. the artifact filter.
// Remove `bpmFromBeats`/`coherenceFromBeats` (and coherenceLiveAlt) once
// that comparison concludes and one formula is picked for good.

export type Beat = { t: number; rr: number }

/**
 * HeartMath-style coherence from RR (inter-beat) intervals.
 *
 * 1. Build a heart-rate tachogram from beat timestamps.
 * 2. Resample it evenly at 4 Hz over the analysis window.
 * 3. Find the peak in the 0.04–0.26 Hz band and take the ratio of the power
 *    inside a narrow window around that peak to the total band power.
 */
const FS = 4 // Hz
const WINDOW_SEC = 64
const LOW = 0.04
const HIGH = 0.26
const PEAK_HALF_WIDTH = 0.015

export function bpmFromBeats(beats: Beat[], lastN = 5): number {
  const recent = beats.slice(-lastN)
  if (!recent.length) return 0
  const mean = recent.reduce((s, b) => s + b.rr, 0) / recent.length
  return mean > 0 ? Math.round(60000 / mean) : 0
}

/** Returns 0..1. Needs ~30s of beats before it is meaningful. */
export function coherenceFromBeats(beats: Beat[], now = Date.now()): number {
  const from = now - WINDOW_SEC * 1000
  const pts = beats
    .filter(b => b.t >= from && b.rr > 300 && b.rr < 2000)
    .map(b => ({ t: b.t / 1000, hr: 60000 / b.rr }))
  if (pts.length < 20) return 0

  const start = pts[0]!.t
  const end = pts[pts.length - 1]!.t
  const span = end - start
  if (span < 20) return 0

  const n = Math.floor(span * FS)
  const series = new Array<number>(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    const t = start + i / FS
    while (j < pts.length - 2 && pts[j + 1]!.t < t) j++
    const a = pts[j]!
    const b = pts[Math.min(j + 1, pts.length - 1)]!
    const dt = b.t - a.t
    const f = dt > 0 ? (t - a.t) / dt : 0
    series[i] = a.hr + (b.hr - a.hr) * Math.min(1, Math.max(0, f))
  }

  // Detrend (remove mean) and apply a Hann window.
  const mean = series.reduce((s, v) => s + v, 0) / n
  const win = series.map((v, i) => (v - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))))

  const df = 0.005
  const bins: { f: number; p: number }[] = []
  for (let f = LOW; f <= HIGH + 1e-9; f += df) {
    let re = 0
    let im = 0
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * f * i) / FS
      re += win[i]! * Math.cos(ang)
      im -= win[i]! * Math.sin(ang)
    }
    bins.push({ f, p: (re * re + im * im) / (n * n) })
  }

  const total = bins.reduce((s, b) => s + b.p, 0)
  if (total <= 0) return 0
  const peak = bins.reduce((best, b) => (b.p > best.p ? b : best), bins[0]!)
  const peakPower = bins.filter(b => Math.abs(b.f - peak.f) <= PEAK_HALF_WIDTH).reduce((s, b) => s + b.p, 0)

  const ratio = peakPower / (total - peakPower || 1e-9)
  // Map the HeartMath-like ratio onto a friendly 0..1 scale.
  return Math.min(1, Math.max(0, ratio / (ratio + 1.2)))
}
