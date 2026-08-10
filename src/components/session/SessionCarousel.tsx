import { useRef, useState } from 'react'
import SessionHeader from '@/components/session/SessionHeader'
import DotIndicator from '@/components/session/DotIndicator'
import Page1Ring from '@/screens/session/Page1Ring'
import Page2Mandala from '@/screens/session/Page2Mandala'
import Page3Scene from '@/screens/session/Page3Scene'
import Page4Summary from '@/screens/session/Page4Summary'
import type { LiveSessionData } from '@/screens/session/types'

interface SessionCarouselProps {
  data: LiveSessionData
  onEndSession: () => void
}

const PAGE_COUNT = 4

// Native CSS scroll-snap instead of a swipe library — 4 full-viewport pages
// in a horizontally scrolling flex row, snap-mandatory. Skrin 4 (the last
// page) additionally scrolls vertically *inside itself*; since the outer
// track only scrolls on the x-axis, there's nothing for a further swipe to
// land on past it — "no further swipe" falls out of it being the last
// child, no extra locking logic needed. SessionHeader and DotIndicator are
// rendered once here (not per-page) so they stay pinned over whichever page
// is currently in view.
export default function SessionCarousel({ data, onEndSession }: SessionCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const scrollToPage = (index: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        <div className="h-full w-full shrink-0 snap-start snap-always">
          <Page1Ring data={data} />
        </div>
        <div className="h-full w-full shrink-0 snap-start snap-always">
          <Page2Mandala data={data} />
        </div>
        <div className="h-full w-full shrink-0 snap-start snap-always">
          <Page3Scene data={data} />
        </div>
        <div className="h-full w-full shrink-0 snap-start snap-always">
          <Page4Summary data={data} />
        </div>
      </div>

      <SessionHeader
        bpm={data.bpm}
        isDeviceConnected={data.isDeviceConnected}
        contactLost={data.contactLost}
        sessionActive={data.sessionActive}
        onEnd={onEndSession}
      />

      <div
        className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
        style={{ bottom: 'calc(var(--nav-height) + 0.875rem + var(--safe-bottom))' }}
      >
        <div className="pointer-events-auto rounded-full bg-black/25 px-3 py-2 backdrop-blur-sm">
          <DotIndicator count={PAGE_COUNT} activeIndex={activeIndex} onSelect={scrollToPage} />
        </div>
      </div>
    </div>
  )
}
