import { useEffect, useRef, useState } from 'react'
import { Play, Info } from 'lucide-react'
import Player from '@vimeo/player'

// Switched from YouTube to Vimeo (2026-10-02) — video is "Latihan
// Pernafasan" on the Madrasah I AM Vimeo account, public (no privacy hash
// needed; confirmed via Vimeo's own public oEmbed endpoint:
// vimeo.com/api/oembed.json?url=https://vimeo.com/1043048429). player.vimeo.com
// (not vimeo.com) is Vimeo's own privacy-conscious embed domain, same
// reasoning as youtube-nocookie.com was for YouTube. dnt=1 ("do not track")
// is Vimeo's closest equivalent; title/byline/portrait=0 strips Vimeo's own
// title+author+avatar overlay, same intent as modestbranding was for
// YouTube. Vimeo's player plays inline on iOS by default — no playsinline
// param needed (unlike YouTube). autoplay=1 is safe here specifically
// because the iframe is only ever created inside a click handler below
// (the thumbnail tap, or the warning overlay's "Faham, teruskan" tap) — i.e.
// synchronously as a direct result of the user's own gesture, which is what
// lets mobile browsers' autoplay-with-sound policies allow it.
const VIDEO_ID = '1043048429'
const EMBED_URL = `https://player.vimeo.com/video/${VIDEO_ID}?title=0&byline=0&portrait=0&dnt=1&autoplay=1`
// Vimeo has no predictable static thumbnail URL pattern (unlike YouTube's
// i.ytimg.com/vi/<id>/...) — this is this exact video's own CDN thumbnail
// URL, read once from that same oEmbed response (640x360 variant; Vimeo
// serves whatever width/height is encoded in the path), not a guessed
// pattern that would work for a different video.
const THUMBNAIL_URL =
  'https://i.vimeocdn.com/video/1966165576-72ec9336e10a496badf8c4123a4a1e824e68b926fc6dca2a8fe234c540da27e6-d_640x360?region=us'

const WARNING_TEXT =
  'Amaran: Jangan amalkan semasa memandu, di dalam air atau sambil berdiri. Hentikan jika pening. Rujuk doktor jika hamil, ada penyakit jantung, darah tinggi atau epilepsi.'

interface WhmVideoCardProps {
  // false once the user swipes to a different carousel page — unmounts the
  // iframe (stops playback) and drops back to the thumbnail, per spec. Does
  // NOT affect onPlay's one-way "has this ever been played" effect upstream,
  // and does NOT reset warningSeen — the warning still only auto-shows once
  // per session even after swiping away and back.
  isActive: boolean
  onPlay: () => void
  // Live playback position in seconds, pushed up from the Vimeo Player API
  // (timeupdate + seeked) — Page2Mandala derives its cue-driven label/sphere
  // timing purely from this value, see that file's own header comment for
  // why that makes seeking/looping/replaying "just work" with no special
  // handling here.
  onTimeUpdate: (seconds: number) => void
  // true only while Vimeo itself reports 'play' (false on 'pause' and
  // 'ended') — distinct from the `playing` state below, which just means
  // "the iframe exists" (true the instant the user taps play, before the
  // video has actually started decoding/playing).
  onPlaybackStateChange: (isPlaying: boolean) => void
}

// Lazy-loaded WHM video — thumbnail + play button only; the real
// player.vimeo.com iframe (and its network request) doesn't exist until
// tapped. Tapping the thumbnail is a normal button click inside the
// carousel's native scroll-snap track, so it never triggers a slide swipe.
//
// Safety warning moved off the slide's permanent layout (2026-10-02) — now a
// one-time overlay shown automatically the first time the user taps play
// (pendingPlay=true: dismissing it also starts the video, since that tap
// WAS the play intent), plus a small ⓘ corner button that reopens the exact
// same text on demand at any time (pendingPlay=false: dismissing it just
// closes the overlay, no playback side effect). warningSeen is a plain
// useState, not persisted anywhere — this component instance lives for the
// whole session (Page2Mandala never unmounts, see SessionCarousel.tsx), so
// "never shown again in this session" falls out of that naturally.
export default function WhmVideoCard({ isActive, onPlay, onTimeUpdate, onPlaybackStateChange }: WhmVideoCardProps) {
  const [playing, setPlaying] = useState(false)
  const [warningSeen, setWarningSeen] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [pendingPlay, setPendingPlay] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Latest-ref pattern so the Player effect below only depends on
  // `playing` — Page2Mandala re-renders often (coherence/zone ticks), and
  // onTimeUpdate/onPlaybackStateChange are inline closures there that get a
  // new identity every render; depending on them directly would tear down
  // and recreate the real Vimeo Player object on every single tick.
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange)
  onPlaybackStateChangeRef.current = onPlaybackStateChange

  useEffect(() => {
    if (!isActive) setPlaying(false)
  }, [isActive])

  // One real @vimeo/player instance per mounted iframe — created only once
  // `playing` is true (the iframe exists by then). `seeked` fires in
  // addition to `timeupdate` so a manual scrub updates the cue immediately
  // rather than waiting for the next ~250ms tick.
  //
  // Deliberately does NOT call player.unload() in cleanup — under
  // StrictMode (main.tsx), React dev-mode double-invokes this effect
  // (mount -> cleanup -> mount) immediately on first mount; unload() sent
  // right as Vimeo was mid-autoplay-handshake left the player permanently
  // stuck buffering at 00:00 (reproduced directly: confirmed the same URL
  // autoplays fine standalone, outside this component, so the StrictMode
  // double-invoke + unload() combination was the actual cause). Removing
  // the iframe from the DOM (the `playing` state flip, not this effect)
  // already stops playback/tears down the embed — no explicit unload needed.
  useEffect(() => {
    if (!playing || !iframeRef.current) return
    const player = new Player(iframeRef.current)
    const handleTime = (data: { seconds: number }) => onTimeUpdateRef.current(data.seconds)
    const handlePlay = () => onPlaybackStateChangeRef.current(true)
    const handlePause = () => onPlaybackStateChangeRef.current(false)
    const handleEnded = () => onPlaybackStateChangeRef.current(false)
    player.on('timeupdate', handleTime)
    player.on('seeked', handleTime)
    player.on('play', handlePlay)
    player.on('pause', handlePause)
    player.on('ended', handleEnded)
    return () => {
      player.off('timeupdate', handleTime)
      player.off('seeked', handleTime)
      player.off('play', handlePlay)
      player.off('pause', handlePause)
      player.off('ended', handleEnded)
      onPlaybackStateChangeRef.current(false)
    }
  }, [playing])

  const handlePlayTap = () => {
    if (warningSeen) {
      setPlaying(true)
      onPlay()
      return
    }
    setPendingPlay(true)
    setWarningOpen(true)
  }

  const handleInfoTap = () => {
    setPendingPlay(false)
    setWarningOpen(true)
  }

  const handleDismiss = () => {
    setWarningSeen(true)
    setWarningOpen(false)
    if (pendingPlay) {
      setPlaying(true)
      onPlay()
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16 / 9' }}>
      {playing ? (
        <iframe
          ref={iframeRef}
          src={EMBED_URL}
          title="Latihan Pernafasan WHM"
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={handlePlayTap}
          aria-label="Mainkan video"
          className="relative flex h-full w-full items-center justify-center active:brightness-95"
        >
          <img src={THUMBNAIL_URL} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="relative flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform active:scale-90">
            <Play size={20} className="text-[var(--color-primary-dark)]" fill="currentColor" />
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={handleInfoTap}
        aria-label="Maklumat keselamatan"
        className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform active:scale-90"
      >
        <Info size={14} />
      </button>

      {warningOpen && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
          <p className="text-[11px] leading-snug text-white">{WARNING_TEXT}</p>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[var(--color-primary-dark)] transition-transform active:scale-95"
          >
            {pendingPlay ? 'Faham, teruskan' : 'Faham'}
          </button>
        </div>
      )}
    </div>
  )
}
