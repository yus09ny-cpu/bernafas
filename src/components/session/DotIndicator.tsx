interface DotIndicatorProps {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
}

export default function DotIndicator({ count, activeIndex, onSelect }: DotIndicatorProps) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Halaman sesi">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Halaman ${i + 1}`}
          onClick={() => onSelect(i)}
          className="flex h-6 w-6 items-center justify-center"
        >
          <span
            className="rounded-full transition-all duration-300"
            style={{
              width: i === activeIndex ? 18 : 6,
              height: 6,
              background: i === activeIndex ? '#ffffff' : 'rgba(255,255,255,0.45)',
            }}
          />
        </button>
      ))}
    </div>
  )
}
