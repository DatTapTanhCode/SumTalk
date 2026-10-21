import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Segment } from '../api/types'
import { cn, formatClock } from '../lib/format'

function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-[2px] bg-foreground/15 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/**
 * Transcript list. Click a line to jump the audio there; the line being played is highlighted.
 * With `follow`, the nearest element marked `data-scroll` sticks to the bottom as text arrives
 * (unless the user scrolled up to read).
 */
export function TranscriptView({
  segments,
  partial,
  mainLanguage,
  currentTime,
  playing = false,
  onSeek,
  query = '',
  follow = false,
  empty,
}: {
  segments: Segment[]
  partial?: string | null
  mainLanguage?: string | null
  currentTime?: number
  playing?: boolean
  onSeek?: (seconds: number) => void
  query?: string
  follow?: boolean
  empty?: ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const trimmedQuery = query.trim()

  const visible = useMemo(() => {
    if (!trimmedQuery) return segments
    const q = trimmedQuery.toLowerCase()
    return segments.filter((s) => s.text.toLowerCase().includes(q))
  }, [segments, trimmedQuery])

  const activeIdx = useMemo(() => {
    if (currentTime === undefined || (!playing && currentTime === 0)) return -1
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start <= currentTime + 0.05) return currentTime <= segments[i].end + 1 ? segments[i].idx : -1
    }
    return -1
  }, [segments, currentTime, playing])

  useEffect(() => {
    const scroller = listRef.current?.closest<HTMLElement>('[data-scroll]')
    if (!scroller) return
    const onScroll = () => {
      stickToBottom.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80
    }
    scroller.addEventListener('scroll', onScroll)
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    if (!follow || !stickToBottom.current) return
    const scroller = listRef.current?.closest<HTMLElement>('[data-scroll]')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [follow, segments.length, partial])

  useEffect(() => {
    if (!playing || activeIdx < 0) return
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIdx, playing])

  if (segments.length === 0 && !partial) return <div ref={listRef}>{empty}</div>

  return (
    <div ref={listRef} className="space-y-px">
      {trimmedQuery && (
        <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          {visible.length} {visible.length === 1 ? 'line matches' : 'lines match'} "{trimmedQuery}"
        </p>
      )}
      {visible.map((segment) => {
        const active = segment.idx === activeIdx
        const rowClass = cn(
          'group flex w-full gap-3 border-l-2 border-transparent py-1.5 pr-3 pl-2.5 text-left transition-colors',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground',
          onSeek && 'cursor-pointer hover:bg-secondary/50',
          active && 'border-l-foreground bg-secondary/60 hover:bg-secondary/60',
        )
        const content = (
          <>
            <span
              className={cn(
                'digital w-16 shrink-0 pt-0.5 text-[16px] leading-none',
                active ? 'text-foreground' : 'text-muted-foreground/80',
              )}
            >
              {formatClock(segment.start)}
            </span>
            <p className="min-w-0 flex-1 text-[16px] leading-[1.75] text-foreground">
              {highlight(segment.text, trimmedQuery)}
            </p>
            {segment.language && mainLanguage && segment.language !== mainLanguage && (
              <span className="mt-1 h-fit rounded-[2px] border border-border px-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase">
                {segment.language}
              </span>
            )}
          </>
        )
        return onSeek ? (
          <button
            key={segment.idx}
            type="button"
            data-idx={segment.idx}
            onClick={() => onSeek(segment.start)}
            className={rowClass}
          >
            {content}
          </button>
        ) : (
          <div key={segment.idx} data-idx={segment.idx} className={rowClass}>
            {content}
          </div>
        )
      })}
      {partial && !trimmedQuery && (
        <div className="flex gap-3 py-2 pr-3 pl-2.5">
          <span className="w-16 shrink-0" />
          <p className="flex-1 text-[16px] leading-[1.75] text-muted-foreground italic">
            {partial}
            <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-[blink_1.05s_steps(1)_infinite] bg-foreground" />
          </p>
        </div>
      )}
    </div>
  )
}
