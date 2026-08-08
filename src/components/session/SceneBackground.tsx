// Full-bleed calming backdrop for Skrin 2 ("Scene"). The brief asks for
// "Bernafas branded imagery" — there is no photography asset in this repo
// yet (public/ only has favicon.svg), and fabricating a stock photo URL
// would be a fake asset masquerading as branded content. This is a
// generated abstract scene built purely from the existing palette tokens
// (index.css @theme) instead: soft drifting light + a horizon, no external
// requests. Swap for a real photographed/illustrated scene asset later by
// replacing this component's body — every page that renders it stays the same.
export default function SceneBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #cfeae6 0%, #bcdcf0 55%, #a9cdec 100%)' }}
      />
      {/* Slow-drifting soft light blobs — the only motion, kept gentle */}
      <div
        className="absolute rounded-full"
        style={{
          width: '70vmax',
          height: '70vmax',
          left: '-20vmax',
          top: '-15vmax',
          background: 'radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)',
          animation: 'bernafas-scene-drift-a 26s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '60vmax',
          height: '60vmax',
          right: '-18vmax',
          bottom: '-20vmax',
          background: 'radial-gradient(circle, rgba(111,195,189,0.4), transparent 70%)',
          animation: 'bernafas-scene-drift-b 32s ease-in-out infinite',
        }}
      />
      {/* Horizon line — a distant "shoreline" feel without needing real imagery */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '38%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.35) 100%)',
        }}
      />
      <style>{`
        @keyframes bernafas-scene-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(4vmax, 3vmax) scale(1.08); }
        }
        @keyframes bernafas-scene-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-3vmax, -4vmax) scale(1.06); }
        }
      `}</style>
    </div>
  )
}
