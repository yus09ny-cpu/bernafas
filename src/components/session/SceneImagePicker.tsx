import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'

interface SceneImagePickerProps {
  hasImage: boolean
  isProcessing: boolean
  error: string | null
  onPick: (file: File) => void
  onClear: () => void
}

// Small upload/remove control for Skrin 3's custom background photo — see
// useSceneImage.ts for how/where the image is actually stored (temporary
// localStorage, flagged for a real Supabase-backed swap later). White-on-
// translucent-black to stay legible over any photo, matching the existing
// "Nafas ke-N" label style already used on this page.
export default function SceneImagePicker({ hasImage, isProcessing, error, onPick, onClear }: SceneImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          aria-label={hasImage ? 'Tukar imej latar' : 'Muat naik imej latar sendiri'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-50"
        >
          <ImagePlus size={16} />
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Buang imej latar, kembali ke latar lalai"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-transform active:scale-90"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {isProcessing && (
        <span className="text-[10px] text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
          Memproses imej…
        </span>
      )}
      {error && (
        <span className="max-w-40 text-right text-[10px] text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
          {error}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = '' // allow picking the same file again later
        }}
      />
    </div>
  )
}
