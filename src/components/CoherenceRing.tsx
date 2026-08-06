interface CoherenceRingProps {
  value: number // 0-1
  label?: string
  size?: number
}

// Live HRV score ring — pastel teal to match Bernafas' palette (distinct
// from Audit Jiwa's purple/gold CoherenceRing).
export default function CoherenceRing({ value, label = 'SKOR HRV', size = 96 }: CoherenceRingProps) {
  const pct = Math.max(0, Math.min(1, value))
  const r = size * 0.42
  const c = 2 * Math.PI * r
  const dash = c * pct
  const center = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(63,140,140,0.12)" strokeWidth={size * 0.06} />
      <circle
        cx={center} cy={center} r={r} fill="none"
        stroke="#3e9c9c" strokeWidth={size * 0.06} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dasharray 600ms ease-out' }}
      />
      <text x={center} y={center + size * 0.06} textAnchor="middle" fontSize={size * 0.24} fontWeight="700" fill="#1e293b">
        {Math.round(pct * 100)}
      </text>
      <text x={center} y={center + size * 0.27} textAnchor="middle" fontSize={size * 0.075} letterSpacing="1.5" fill="#64748b">
        {label}
      </text>
    </svg>
  )
}
