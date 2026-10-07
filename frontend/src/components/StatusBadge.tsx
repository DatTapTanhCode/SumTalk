import type { MeetingStatus } from '../api/types'
import { cn } from '../lib/format'

const STYLES: Record<MeetingStatus | 'local', { label: string; className: string; dot: string; pulse?: boolean }> = {
  recording: { label: 'Recording', className: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', pulse: true },
  uploading: { label: 'Uploading', className: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', pulse: true },
  queued: { label: 'Queued', className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  processing: { label: 'Preparing audio', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', pulse: true },
  transcribing: { label: 'Transcribing', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500', pulse: true },
  done: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  local: { label: 'On this device', className: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
}

export function StatusBadge({ status, progress }: { status: MeetingStatus | 'local'; progress?: number }) {
  const style = STYLES[status]
  const label = status === 'transcribing' && progress ? `${style.label} ${Math.round(progress * 100)}%` : style.label
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap', style.className)}>
      <span className="relative flex size-1.5">
        {style.pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', style.dot)} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', style.dot)} />
      </span>
      {label}
    </span>
  )
}
