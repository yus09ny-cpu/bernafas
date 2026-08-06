// ─── BPM Smoother (median + adaptive EMA) ────────────────────────────────
// Ported from Audit Jiwa's ZikirKhafiPlayer.tsx (defined inline there,
// duplicated across two files) — extracted here as its own module since
// this is a fresh codebase and there's no reason to repeat that duplication.
//
// Median-of-window first (throws out single-sample spikes/dropouts), then an
// EMA with an adaptive alpha: a big jump (>15 BPM) is damped harder, on the
// assumption a real heart doesn't jump that far in one sample — this keeps
// the pacer/orb visually smooth. Achievement/tier logic that needs to see
// genuine brief dips should read raw per-reading values instead, not this.
export class BpmSmoother {
  private window: number[] = []
  private ema: number | null = null
  constructor(private medianWindow = 5, private baseAlpha = 0.2) {}

  add(sample: number): number {
    this.window.push(sample)
    if (this.window.length > this.medianWindow) this.window.shift()
    const sorted = [...this.window].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (this.ema === null) { this.ema = median; return this.ema }
    const delta = Math.abs(median - this.ema)
    const alpha = delta > 15 ? this.baseAlpha * 0.3 : this.baseAlpha
    this.ema = alpha * median + (1 - alpha) * this.ema
    return this.ema
  }

  consistency(): number {
    if (this.window.length < 3) return 1
    const mean = this.window.reduce((a, b) => a + b, 0) / this.window.length
    const variance = this.window.reduce((a, b) => a + (b - mean) ** 2, 0) / this.window.length
    return Math.max(0, 1 - Math.min(1, Math.sqrt(variance) / mean))
  }
}
