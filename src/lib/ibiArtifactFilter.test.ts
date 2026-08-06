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
    expect(filter.accept(820)).toBe(820) // +2.5%
    expect(filter.accept(790)).toBe(790) // -3.7% from 820
  })

  it('rejects a single jitter spike beyond the default 20% threshold', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    expect(filter.accept(1200)).toBeNull() // +50% jump — jitter, not a real beat
  })

  it('keeps the last accepted value as baseline, not the rejected spike', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    expect(filter.accept(1200)).toBeNull() // rejected, baseline stays 800
    // A beat close to the pre-spike baseline (800) should still be accepted,
    // proving the rejected 1200 never became the new comparison point.
    expect(filter.accept(820)).toBe(820)
  })

  it('does not let one bad beat cascade into rejecting everything after it', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(800)
    filter.accept(1200) // rejected
    filter.accept(1210) // would be accepted if baseline had shifted to 1200 — must still reject vs 800
    expect(filter.accept(1210)).toBeNull()
    expect(filter.accept(810)).toBe(810) // genuine continuation from 800 baseline
  })

  it('lets a genuine sustained heart-rate change through, one step at a time', () => {
    const filter = new IbiArtifactFilter()
    filter.accept(1000) // 60 bpm
    // Gradual ramp down to ~85 bpm (706ms) in steps under 20% each — should
    // all be accepted, unlike a single-sample jump to the same endpoint.
    expect(filter.accept(850)).toBe(850) // -15%
    expect(filter.accept(720)).toBe(720) // -15.3%
  })

  it('respects a custom threshold', () => {
    const strict = new IbiArtifactFilter(0.05)
    strict.accept(800)
    expect(strict.accept(850)).toBeNull() // +6.25%, rejected at 5% threshold
    const loose = new IbiArtifactFilter(0.5)
    loose.accept(800)
    expect(loose.accept(1150)).toBe(1150) // +43.75%, accepted at 50% threshold
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
    expect(DEFAULT_IBI_ARTIFACT_THRESHOLD_PCT).toBe(0.2)
  })
})
