// SMOOTHNESS_PRESETS/smoothnessLabel were ported verbatim from
// calm-breath-pulse's src/components/session/SmoothnessSetting.tsx for
// Skrin 1. The standalone SmoothnessSetting popover component that used to
// live here is gone — its trigger + popup were folded into
// DeviceSettingsPopover.tsx (one icon for device + smoothness instead of
// two), which is now the only consumer of these two exports.
export const SMOOTHNESS_PRESETS = [
  { max: 0.34, label: 'Tajam' },
  { max: 0.84, label: 'Sederhana' },
  { max: 1.34, label: 'Semula jadi' },
  { max: 2, label: 'Sangat lembut' },
] as const

export function smoothnessLabel(value: number) {
  return SMOOTHNESS_PRESETS.find(p => value <= p.max)?.label ?? 'Semula jadi'
}
