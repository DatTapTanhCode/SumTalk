import type { MeetingStatus } from '../api/types'
import { cn } from '../lib/format'

/** Hardware readout, not a pill: 1px box, square dot, mono label. */
const STYLES: Record<MeetingStatus | 'local', { label: string; className: string; dot: string; pulse?: boolean }> = {
  recording: { label: 'Recording', className: 'border-live/40 bg-live-soft text-live', dot: 'bg-live', pulse: true },
  uploading: { label: 'Uploading', className: 'border-border bg-card text-foreground', dot: 'bg-foreground', pulse: true },
  queued: { label: 'Queued', className: 'border-border bg-card text-muted-foreground', dot: 'bg-muted-foreground' },
  processing: { label: 'Preparing audio', className: 'border-border bg-card text-foreground', dot: 'bg-muted-foreground', pulse: true },
  transcribing: { label: 'Transcribing', className: 'border-border bg-secondary text-foreground', dot: 'bg-foreground', pulse: true },
  done: { label: 'Ready', className: 'border-border bg-card text-foreground', dot: 'bg-foreground' },
  failed: { label: 'Failed', className: 'border-live/40 bg-card text-live', dot: 'bg-live' },
  local: { label: 'On this device', className: 'border-border bg-secondary text-muted-foreground', dot: 'bg-muted-foreground' },
}

export function StatusBadge({ status, progress, className }: { status: MeetingStatus | 'local'; progress?: number; className?: string }) {
  const style = STYLES[status]
  const label = status === 'transcribing' && progress ? `${style.label} ${Math.round(progress * 100)}%` : style.label
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] whitespace-nowrap uppercase',
        style.className,
        className,
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {style.pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-[1px] opacity-60', style.dot)} />}
        <span className={cn('relative inline-flex size-1.5 rounded-[1px]', style.dot)} />
      </span>
      {label}
    </span>
  )
}
