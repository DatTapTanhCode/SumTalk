import { useEffect, useState } from 'react'
import { cn, formatClock } from '../lib/format'

const SCRIPT = [
  { at: 3, text: 'Morning. Let’s start with the roadmap.' },
  { at: 7, text: 'June release stays on track.' },
]

const FULL = SCRIPT.map((line) => line.text).join('\n')

function charDelay(char: string): number {
  if (char === '.' || char === '?' || char === '!') return 240
  if (char === ',' || char === '—') return 130
  return 32
}

/** Idle preview: a short transcript is typed out, left to settle, then erased and replayed. */
export function TranscriptDemo() {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [chars, setChars] = useState(0)
  const [phase, setPhase] = useState<'resting' | 'typing' | 'holding' | 'deleting'>('resting')

  useEffect(() => {
    if (reduced) return
    if (phase === 'typing') {
      const id =
        chars >= FULL.length
          ? setTimeout(() => setPhase('holding'), 0)
          : setTimeout(() => setChars((value) => value + 1), charDelay(FULL[chars]))
      return () => clearTimeout(id)
    }
    if (phase === 'holding') {
      const id = setTimeout(() => setPhase('deleting'), 1900)
      return () => clearTimeout(id)
    }
    if (phase === 'deleting') {
      const id =
        chars === 0
          ? setTimeout(() => setPhase('resting'), 0)
          : setTimeout(() => setChars((value) => value - 1), 14)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setPhase('typing'), 900)
    return () => clearTimeout(id)
  }, [chars, phase, reduced])

  const typed = reduced ? FULL : FULL.slice(0, chars)
  const rows = typed ? typed.split('\n') : []

  return (
    <div aria-hidden="true" className="mt-6 w-full max-w-sm overflow-hidden rounded-md border border-border bg-card text-left">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">Sample</span>
        <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">EN</span>
      </div>
      <div className="min-h-[68px] py-2">
        {rows.map((text, i) => {
          const last = i === rows.length - 1
          const partial = last && !reduced && (phase === 'typing' || phase === 'deleting')
          return (
            <div key={i} className="flex gap-3 px-3 py-1">
              <span className="digital w-12 shrink-0 pt-0.5 text-[13px] leading-none text-muted-foreground/80">
                {formatClock(SCRIPT[i].at)}
              </span>
              <p
                className={cn(
                  'min-w-0 flex-1 text-[14px] leading-[1.6]',
                  partial ? 'text-muted-foreground italic' : 'text-foreground',
                )}
              >
                {text}
                {last && !reduced && (
                  <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-[blink_1.05s_steps(1)_infinite] bg-foreground" />
                )}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
