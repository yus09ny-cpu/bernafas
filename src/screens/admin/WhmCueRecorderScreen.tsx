import { useEffect, useRef, useState } from 'react'
import { Undo2, Copy, CheckCircle2 } from 'lucide-react'
import Player from '@vimeo/player'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import AuthScreen from '@/screens/AuthScreen'
import type { WhmCuePhase } from '@/data/whmCues'

const VIDEO_ID = '1043048429'
const EMBED_URL = `https://player.vimeo.com/video/${VIDEO_ID}?title=0&byline=0&portrait=0&dnt=1`

const PHASE_BUTTONS: { phase: WhmCuePhase; label: string; color: string }[] = [
  { phase: 'tarik', label: 'Tarik', color: '#3fae7a' },
  { phase: 'hembus', label: 'Hembus', color: '#5b8fd9' },
  { phase: 'tahan', label: 'Tahan', color: '#e0614a' },
  { phase: 'pulih', label: 'Pulih', color: '#6fa8dc' },
]

interface RecordedCue {
  t: number
  phase: WhmCuePhase
}

function buildPasteText(cues: RecordedCue[]): string {
  const lines = cues.map(c => `  { t: ${c.t}, phase: '${c.phase}' },`).join('\n')
  return `export const WHM_CUES: WhmCue[] = [\n${lines}\n]`
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Dev-only cue recorder for src/data/whmCues.ts — hidden behind /admin/whm-cues,
// same hasAdminRole gate as every other /admin/* screen (api/admin/whm-cues.ts).
// Deliberately rough (per product-owner spec: "it's fine if the recorder is
// rough — it's just for me") — plays the real WHM video, 4 big phase
// buttons each stamp the Vimeo player's current time, "Salin" copies a
// ready-to-paste `export const WHM_CUES = [...]` block in the exact shape
// src/data/whmCues.ts expects.
export default function WhmCueRecorderScreen() {
  const { status } = useAuth()
  const [forbidden, setForbidden] = useState(false)
  const [checked, setChecked] = useState(false)
  const [cues, setCues] = useState<RecordedCue[]>([])
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (status !== 'signed-in') return
    authHeader().then(headers => {
      fetch('/api/admin/whm-cues', { headers }).then(async response => {
        if (response.status === 403) {
          setForbidden(true)
        }
        setChecked(true)
      })
    })
  }, [status])

  // No player.unload() in cleanup — see WhmVideoCard.tsx's own comment on
  // this exact gotcha (StrictMode's dev-mode double-invoke + unload() can
  // leave Vimeo's player stuck mid-handshake). Not strictly needed here
  // either way (this iframe has no autoplay, user presses Vimeo's own play
  // button), but kept consistent with the fix made there.
  useEffect(() => {
    if (!checked || forbidden || !iframeRef.current) return
    playerRef.current = new Player(iframeRef.current)
    return () => {
      playerRef.current = null
    }
  }, [checked, forbidden])

  const recordCue = async (phase: WhmCuePhase) => {
    const player = playerRef.current
    if (!player) return
    const seconds = await player.getCurrentTime()
    setCues(prev => [...prev, { t: Math.round(seconds * 10) / 10, phase }])
    setCopied(false)
  }

  const undoLast = () => {
    setCues(prev => prev.slice(0, -1))
    setCopied(false)
  }

  const copyResult = () => {
    navigator.clipboard.writeText(buildPasteText(cues)).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  if (status === 'loading' || (status === 'signed-in' && !checked)) return null
  if (status !== 'signed-in') return <AuthScreen />
  if (forbidden) {
    return (
      <div className="flex h-dvh w-full items-center justify-center px-8 text-center">
        <p className="text-sm text-[var(--color-warm)]">Tiada akses.</p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh w-full flex-col gap-4 overflow-y-auto bg-[var(--color-bg)] px-5 py-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-top))' }}>
      <h1 className="text-lg font-bold text-[var(--color-primary-dark)]">Rakam Isyarat WHM</h1>

      <div className="w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          ref={iframeRef}
          src={EMBED_URL}
          title="Latihan Pernafasan WHM — recorder"
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          allowFullScreen
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PHASE_BUTTONS.map(({ phase, label, color }) => (
          <button
            key={phase}
            type="button"
            onClick={() => recordCue(phase)}
            style={{ backgroundColor: color }}
            className="rounded-2xl px-4 py-6 text-base font-bold text-white transition-transform active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={undoLast}
          disabled={cues.length === 0}
          className="flex items-center gap-2 rounded-full border border-[var(--color-card-border)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--color-text)] disabled:opacity-40"
        >
          <Undo2 size={16} /> Buang terakhir
        </button>
        <button
          type="button"
          onClick={copyResult}
          disabled={cues.length === 0}
          className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />} {copied ? 'Disalin!' : 'Salin'}
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">{cues.length} isyarat</span>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-white/70 p-3 text-xs">
        {cues.length === 0 && <span className="text-[var(--color-text-muted)]">Belum ada isyarat direkod.</span>}
        {cues.map((c, i) => (
          <div key={i} className="flex justify-between border-b border-[var(--color-card-border)] border-opacity-20 py-1 last:border-0">
            <span className="tabular-nums">{c.t}s</span>
            <span className="font-medium">{c.phase}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
