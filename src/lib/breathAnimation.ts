// Shared breath-scale constants — one source of truth for every
// phase-flip-driven inhale/exhale visual in the app (currently PulseDot's
// halo + breath-wrapper on Skrin 3, FlowerBloom on Skrin 2), so they can't
// silently drift apart in scale range or easing again the way FlowerBloom
// did (it had its own local 1.08/0.94 + an older easing curve).
//
// PulsingSphere (Skrin 1) is NOT built on these — its `smoothness` setting
// needs a full sampled-keyframe curve blend (triangle/sine/smoothstep),
// which a plain two-point ease can't reproduce, so it keeps its own
// MIN/MAX+curve logic. Same underlying idea, different mechanism by design.

// 1.4/0.7 — the value PulseDot's tuning notes settled on: 1.15/0.88 was
// confirmed *correct* but too subtle to notice; this range is
// noticeable-but-not-exaggerated, verified against real hardware.
export const BREATH_SCALE_MIN = 0.7
export const BREATH_SCALE_MAX = 1.4

// easeInOutSine — flatter through the middle and gentler acceleration
// into/out of the phase-flip turnaround than a plain easeInOutQuad
// (cubic-bezier(0.45, 0, 0.55, 1)), which reads as slightly mechanical at
// the peak/trough.
export const BREATH_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)'
