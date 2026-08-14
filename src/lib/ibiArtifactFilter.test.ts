import { describe, it, expect } from 'vitest'
import { IbiArtifactFilter, DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT } from './ibiArtifactFilter'

describe('IbiArtifactFilter', () => {
  it('always accepts the first IBI (nothing to compare against)', () => {
    const filter = new IbiArtifactFilter()
    expect(filter.accept(800)).toBe(800)
  })

  it('accepts a run of stable IBIs within threshold', () => {
    const filter = new IbiArtifactFilter()
    expect(filter.accept(800)).toBe(800)
    expect(filter.accept(820)).toBe(820) // vs median([800])=800, +2.5%
    expect(filter.accept(790)).toBe(790) // vs median([800,820])=810, -2.5%
  })

  it('rejects a single jitter spike beyond the default 40% threshold', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    expect(filter.accept(1200)).toBeNull() // +50% jump vs baseline 800 — jitter, not a real beat
  })

  it('keeps the rolling-median baseline, not the rejected spike', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    expect(filter.accept(1200)).toBeNull() // rejected, baseline stays median([800])=800
    // A beat close to the pre-spike baseline (800) should still be accepted,
    // proving the rejected 1200 never entered the accepted history.
    expect(filter.accept(820)).toBe(820)
  })

  it('does not let one bad beat cascade into rejecting everything after it', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    filter.accept(1200) // rejected
    filter.accept(1210) // would be accepted if baseline had shifted to ~1200 — must still reject vs 800
    expect(filter.accept(1210)).toBeNull()
    expect(filter.accept(810)).toBe(810) // genuine continuation from 800 baseline
  })

  it('lets a genuine sustained heart-rate change through, one step at a time', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(1000) // 60 bpm
    // Gradual ramp down to ~85 bpm (720ms) in steps under 40% of the
    // rolling-median baseline at each step — should all be accepted, unlike
    // a single-sample jump straight to the same endpoint.
    expect(filter.accept(850)).toBe(850) // vs median([1000])=1000, -15%
    expect(filter.accept(720)).toBe(720) // vs median([1000,850])=925, -22.2%
  })

  it('respects a custom moderate threshold', () => {
    const strict = new IbiArtifactFilter(0.05)
    strict.accept(800)
    expect(strict.accept(850)).toBeNull() // +6.25%, rejected at 5% threshold
    const loose = new IbiArtifactFilter(0.5)
    loose.accept(800)
    expect(loose.accept(1150)).toBe(1150) // +43.75%, accepted at 50% threshold
  })

  it('rejects beyond the hard 80% ceiling even if a custom threshold is looser', () => {
    // The moderate threshold is tunable; this ceiling isn't — a future
    // retune of the constructor arg can't accidentally let extreme jumps
    // (the dropped-beat pattern that poisoned the old single-sample
    // baseline in real telemetry) through.
    const veryLoose = new IbiArtifactFilter(0.95)
    veryLoose.accept(800)
    expect(veryLoose.accept(2000)).toBeNull() // +150%, over the 80% ceiling despite the 95% custom threshold
  })

  it('rejects a near-integer-multiple jump (dropped-beat pattern) regardless of the threshold', () => {
    // ~1.75x the baseline (75% jump) — under both the 80% hard ceiling and
    // a deliberately loose 90% moderate threshold, so only the
    // near-multiple check explains the rejection. Mirrors the real dropped-
    // beat pattern confirmed in production telemetry (e.g. a genuine 1318ms
    // IBI recorded as 439ms/1319ms — almost exactly 1/3x and 3x the true
    // beat interval when a beat gets dropped, not smoothly graded jitter).
    const loose = new IbiArtifactFilter(0.9)
    loose.accept(800)
    expect(loose.accept(1400)).toBeNull() // ratio 1.75 — within 15% of 2x
  })

  it("resists one bad ACCEPTED sample poisoning the baseline (the real failure mode this fix targets)", () => {
    // A real session log caught this exact pattern under the old design: a
    // single spurious accepted sample became the sole comparison point and
    // never updated again, rejecting 18+ consecutive genuine beats
    // afterward. A rolling median should barely move when only one of
    // several recent values is an outlier.
    const filter = new IbiArtifactFilter()
    for (let i = 0; i < 5; i++) filter.accept(800) // build a stable history
    // A borderline-accepted outlier (37.5% jump, just under the 40%
    // moderate threshold) gets in...
    expect(filter.accept(1100)).toBe(1100)
    // ...but the median of [800,800,800,800,800,1100] is still 800 (the
    // outlier is only 1 of 6), so a genuine continuation of the real ~800ms
    // rhythm is still accepted right after — unlike a single-last-accepted
    // baseline, which would have jumped straight to 1100 and started
    // rejecting real 800ms beats as ~27% "jumps" from a wrong reference point.
    expect(filter.accept(810)).toBe(810)
    expect(filter.accept(795)).toBe(795)
  })

  it('resets the baseline for a new session', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    filter.reset()
    // After reset, even a value that would've been a huge jump from 800 is
    // treated as a fresh first sample and accepted unconditionally.
    expect(filter.accept(2000)).toBe(2000)
  })

  it('exports a documented default threshold', () => {
    expect(DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT).toBe(0.4)
  })
})
