// ─── Coherence zones — red/blue/green banding ──────────────────────────────
// HeartMath-style three-band split of computeCoherence()'s 0-1 score, used
// everywhere the live score needs a color/label instead of a raw number:
// the segmented ring (Skrin 1/3), the coherence-over-time band chart, and
// the achievement% calculation (see sessionStats.ts). One place so the ring,
// the chart, and the score never drift out of sync on where a boundary sits.
//
// Thresholds (0.34 / 0.67) are an even three-way split of the 0-1 range —
// not independently validated against Bernafas session data, same
// calibration caveat as computeCoherence()'s /6.5 constant in
// hrvCoherence.ts. Re-tune here (not at each call site) if real sessions
// show the bands feel wrong.
export type CoherenceZone = 'low' | 'medium' | 'high'

// Exported so the coherence-over-time band chart can draw its zone bands at
// exactly these boundaries — the bands and getCoherenceZone() must never
// disagree about where "medium" starts.
export const ZONE_BOUNDARY = { lowMax: 0.34, mediumMax: 0.67 }

export function getCoherenceZone(value: number): CoherenceZone {
  if (value < ZONE_BOUNDARY.lowMax) return 'low'
  if (value < ZONE_BOUNDARY.mediumMax) return 'medium'
  return 'high'
}

// Colors validated with the dataviz skill's palette validator
// (scripts/validate_palette.js) against a white/pastel surface — worst
// adjacent CVD ΔE 16.9, worst normal-vision ΔE 19.2, all PASS except green's
// contrast-vs-surface which WARNs (2.78:1) and is why every use of these
// colors below is paired with a text/icon label, never color alone.
export const ZONE_COLOR: Record<CoherenceZone, string> = {
  low: '#e0614a',
  medium: '#5b8fd9',
  high: '#3fae7a',
}

export const ZONE_LABEL_BM: Record<CoherenceZone, string> = {
  low: 'Rendah',
  medium: 'Sederhana',
  high: 'Tinggi',
}
