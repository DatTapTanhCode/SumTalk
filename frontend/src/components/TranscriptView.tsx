import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Segment } from '../api/types'
import { cn, formatClock } from '../lib/format'

function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit">
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
    <div ref={listRef} className="space-y-0.5">
      {trimmedQuery && (
        <p className="px-3 pb-2 text-xs text-slate-500">
          {visible.length} {visible.length === 1 ? 'line matches' : 'lines match'} "{trimmedQuery}"
        </p>
      )}
      {visible.map((segment) => {
        const active = segment.idx === activeIdx
        return (
          <div
            key={segment.idx}
            data-idx={segment.idx}
            onClick={() => onSeek?.(segment.start)}
            className={cn(
              'group flex gap-3 rounded-xl px-3 py-2 transition-colors',
              onSeek && 'cursor-pointer hover:bg-slate-50',
              active && 'bg-indigo-50 hover:bg-indigo-50',
            )}
          >
            <span
              className={cn(
                'w-12 shrink-0 pt-0.5 font-mono text-xs tabular-nums',
                active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500',
              )}
            >
              {formatClock(segment.start)}
            </span>
            <p className={cn('min-w-0 flex-1 text-[15px] leading-relaxed', active ? 'text-slate-900' : 'text-slate-700')}>
              {highlight(segment.text, trimmedQuery)}
            </p>
            {segment.language && mainLanguage && segment.language !== mainLanguage && (
              <span className="mt-0.5 h-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                {segment.language}
              </span>
            )}
          </div>
        )
      })}
      {partial && !trimmedQuery && (
        <div className="flex gap-3 px-3 py-2">
          <span className="w-12 shrink-0" />
          <p className="flex-1 text-[15px] leading-relaxed text-slate-400 italic">
            {partial}
            <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-slate-400" />
          </p>
        </div>
      )}
    </div>
  )
}
