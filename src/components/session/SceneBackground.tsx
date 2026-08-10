// Full-bleed calming backdrop for Skrin 3 ("Scene"). The brief originally
// asked for "Bernafas branded imagery" with no photography asset in the
// repo — this generated abstract scene (soft drifting light + a horizon,
// built purely from the existing palette tokens, no external requests)
// was the fallback for that. It's still the default: a user can now
// replace it with their own photo (see useSceneImage.ts / Page3Scene.tsx),
// passed in here as `imageDataUrl`.
export default function SceneBackground({ imageDataUrl }: { imageDataUrl?: string | null }) {
  if (imageDataUrl) {
    return (
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageDataUrl})` }} />
        {/* Legibility overlay — a user's own photo can be any brightness or
            contrast; this keeps the white waveform/pulse-dot/labels
            readable over it regardless of what they picked, same purpose
            the generated scene's horizon gradient already served below. */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.06) 35%, rgba(0,0,0,0.34) 100%)' }}
        />
      </div>
    )
  }

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
