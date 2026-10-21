import { CircleAlert, CloudOff, FileAudio, Inbox, Mic, MoreHorizontal, Search, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '@/api/client'
import type { Meeting } from '@/api/types'
import { StatusBadge } from '@/components/StatusBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Notice } from '@/components/primitives'
import { cn, formatDateTime, formatDuration } from '@/lib/format'
import { languageName } from '@/lib/languages'
import { useStore } from '@/lib/store'
import type { LocalRecording } from '@/offline/db'
import { syncStore } from '@/offline/sync'

type StatusFilter = 'all' | 'transcribed' | 'progress' | 'failed'
type SortKey = 'newest' | 'oldest' | 'longest' | 'title'

const BUSY_STATUSES: Meeting['status'][] = ['recording', 'uploading', 'queued', 'processing', 'transcribing']

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'transcribed', label: 'Transcribed' },
  { key: 'progress', label: 'In progress' },
  { key: 'failed', label: 'Failed' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'longest', label: 'Longest first' },
  { key: 'title', label: 'Title A–Z' },
]

const DAY_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Earlier']

const meetingTime = (meeting: Meeting) => meeting.meeting_at ?? meeting.created_at

function matchesFilter(meeting: Meeting, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'transcribed') return meeting.status === 'done'
  if (filter === 'progress') return BUSY_STATUSES.includes(meeting.status)
  return meeting.status === 'failed'
}

/** How long a transcription still needs, assuming 1x realtime - an upper bound, so it is shown with "~". */
function remainingSeconds(meeting: Meeting): number | null {
  if (meeting.status !== 'transcribing' || meeting.duration_sec <= 0) return null
  if (meeting.progress <= 0 || meeting.progress >= 1) return null
  return Math.max(1, meeting.duration_sec * (1 - meeting.progress))
}

function formatRemaining(seconds: number): string {
  if (seconds < 60) return '<1m'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** Calendar-day bucket, so "Today" does not depend on a 24-hour window. */
function dayBucket(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(now) - start(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Last 7 days'
  return 'Earlier'
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  active,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning'
  onClick?: () => void
  active?: boolean
}) {
  const className = cn(
    'w-full bg-card px-4 py-3 text-left transition-colors',
    onClick && 'hover:bg-secondary/60',
    active && 'bg-secondary',
  )
  const body = (
    <>
      <div
        className={cn(
          'font-mono text-[10px] tracking-[0.14em] uppercase',
          tone === 'warning' ? 'text-live' : 'text-muted-foreground',
        )}
      >
        {label}
      </div>
      <div className={cn('digital mt-1.5 text-[38px] leading-none', tone === 'warning' ? 'text-live' : 'text-foreground')}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}

function RowActions({
  meeting,
  onRename,
  onDelete,
}: {
  meeting: Meeting
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${meeting.title}`}
          className="relative z-20 shrink-0 text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MeetingRow({
  meeting,
  pending,
  editing,
  draft,
  onDraft,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  meeting: Meeting
  pending: number
  editing: boolean
  draft: string
  onDraft: (value: string) => void
  onStartRename: () => void
  onCommitRename: () => void
  onCancelRename: () => void
  onDelete: () => void
}) {
  const language = meeting.language ?? meeting.detected_language
  const remaining = remainingSeconds(meeting)
  const when = meeting.meeting_at ?? meeting.created_at

  return (
    <div className="group row-rule relative flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 sm:px-5">
      {!editing && (
        <Link
          to={`/meetings/${meeting.id}`}
          aria-label={`Open ${meeting.title}`}
          className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground"
        />
      )}
      <div
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-[3px] border border-border bg-background',
          meeting.source === 'upload' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {meeting.source === 'upload' ? <FileAudio className="size-4" /> : <Mic className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancelRename()
              }
            }}
            aria-label="Meeting title"
            className="relative z-20 w-full rounded-[3px] border border-foreground bg-card px-2 py-1 text-base font-medium outline-none"
          />
        ) : (
          <div className="truncate text-[15px] font-semibold text-foreground">{meeting.title}</div>
        )}
        <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
          <span>{formatDateTime(when)}</span>
          {meeting.duration_sec > 0 && <span>· {formatDuration(meeting.duration_sec)}</span>}
          {remaining !== null && <span className="text-foreground">· ~{formatRemaining(remaining)} left</span>}
          {language && <span>· {languageName(language)}</span>}
        </div>
        <StatusBadge status={meeting.status} progress={meeting.progress} className="mt-1.5 sm:hidden" />
      </div>
      {pending > 0 && (
        <span className="hidden rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase sm:inline">
          {pending} chunks on device
        </span>
      )}
      <StatusBadge status={meeting.status} progress={meeting.progress} className="hidden sm:inline-flex" />
      {!editing && <RowActions meeting={meeting} onRename={onStartRename} onDelete={onDelete} />}
    </div>
  )
}

function LocalRow({ recording, pending }: { recording: LocalRecording; pending: number }) {
  return (
    <Link
      to={`/meetings/${recording.id}`}
      className="row-rule flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 sm:px-5"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-border bg-background text-muted-foreground">
        <CloudOff className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-foreground">{recording.title}</div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
          {formatDateTime(recording.meetingAt ?? recording.startedAt)} · {formatDuration(recording.totalSamples / 16000)} · {pending} chunks waiting
          {recording.error && <span className="text-live"> · {recording.error}</span>}
        </div>
      </div>
      <StatusBadge status="local" />
    </Link>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="bg-secondary/60 px-4 py-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:px-5">{label}</div>
  )
}

export function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const renameCancelled = useRef(false)
  const sync = useStore(syncStore)

  const load = useCallback(async () => {
    try {
      setMeetings(await api.listMeetings())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(load, 4000)
    return () => window.clearInterval(timer)
  }, [load])

  const serverIds = useMemo(() => new Set(meetings?.map((m) => m.id)), [meetings])
  const localOnly = sync.recordings.filter((r) => !serverIds.has(r.id))

  const stats = useMemo(() => {
    const list = meetings ?? []
    const busy = list.filter((m) => BUSY_STATUSES.includes(m.status))
    return {
      meetings: list.length,
      recorded: list.reduce((sum, m) => sum + (m.duration_sec || 0), 0),
      transcribed: list.filter((m) => m.status === 'done').length,
      busy: busy.length,
      failed: list.filter((m) => m.status === 'failed').length,
      remaining: busy.reduce((sum, m) => sum + (remainingSeconds(m) ?? 0), 0),
    }
  }, [meetings])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (meetings ?? []).filter((m) => matchesFilter(m, filter) && m.title.toLowerCase().includes(q))
    const newestFirst = (a: Meeting, b: Meeting) => Date.parse(meetingTime(b)) - Date.parse(meetingTime(a))
    if (sort === 'newest') list.sort(newestFirst)
    else if (sort === 'oldest') list.sort((a, b) => newestFirst(b, a))
    else if (sort === 'longest') list.sort((a, b) => b.duration_sec - a.duration_sec)
    else list.sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [meetings, filter, query, sort])

  const groups = useMemo(() => {
    if (sort !== 'newest' && sort !== 'oldest') return [{ label: null as string | null, items: visible }]
    const buckets = new Map<string, Meeting[]>()
    for (const meeting of visible) {
      const key = dayBucket(meetingTime(meeting))
      buckets.set(key, [...(buckets.get(key) ?? []), meeting])
    }
    return DAY_ORDER.filter((label) => buckets.has(label)).map((label) => ({ label, items: buckets.get(label) ?? [] }))
  }, [visible, sort])

  const total = meetings?.length ?? 0
  const filtering = filter !== 'all' || query.trim() !== ''

  const startRename = (meeting: Meeting) => {
    renameCancelled.current = false
    setEditingId(meeting.id)
    setDraft(meeting.title)
  }

  const commitRename = async (meeting: Meeting) => {
    if (renameCancelled.current) {
      renameCancelled.current = false
      setEditingId(null)
      return
    }
    const title = draft.trim()
    setEditingId(null)
    if (!title || title === meeting.title) return
    setActionError(null)
    try {
      const updated = await api.renameMeeting(meeting.id, title)
      setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev)
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  const cancelRename = () => {
    renameCancelled.current = true
    setEditingId(null)
  }

  const deleteMeeting = async () => {
    const meeting = pendingDelete
    if (!meeting) return
    setPendingDelete(null)
    setActionError(null)
    try {
      await api.deleteMeeting(meeting.id)
      setMeetings((prev) => prev?.filter((m) => m.id !== meeting.id) ?? prev)
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  const clearFilters = () => {
    setFilter('all')
    setQuery('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Library</div>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-foreground">Meetings</h1>
          <p className="mt-1 text-base text-muted-foreground">Record or upload a meeting and get the transcript in the language it was spoken.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="lg">
            <Link to="/upload">
              <Upload className="size-4" /> Upload audio
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/record">
              <Mic className="size-4" /> New recording
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Notice tone="warning" icon={<CircleAlert className="size-4" />} title="Can't load meetings from the server">
          {error}. Recordings made now are kept on this device and upload when the server is reachable.
        </Notice>
      )}
      {actionError && (
        <Notice tone="error" icon={<CircleAlert className="size-4" />} title="That didn't work">
          {actionError}
        </Notice>
      )}

      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4"
      >
        <Stat
          label="All meetings"
          value={meetings === null ? '—' : String(stats.meetings)}
          hint={meetings === null ? 'in your library' : `${formatDuration(stats.recorded)} of audio`}
          onClick={() => setFilter('all')}
          active={filter === 'all'}
        />
        <Stat
          label="Transcribed"
          value={meetings === null ? '—' : String(stats.transcribed)}
          hint="ready to read"
          onClick={() => setFilter(filter === 'transcribed' ? 'all' : 'transcribed')}
          active={filter === 'transcribed'}
        />
        <Stat
          label="In progress"
          value={meetings === null ? '—' : String(stats.busy)}
          hint={stats.remaining > 0 ? `~${formatRemaining(stats.remaining)} left` : 'nothing running'}
          onClick={() => setFilter(filter === 'progress' ? 'all' : 'progress')}
          active={filter === 'progress'}
        />
        <Stat
          label="Failed"
          value={meetings === null ? '—' : String(stats.failed)}
          hint="couldn't be processed"
          tone={stats.failed > 0 ? 'warning' : 'default'}
          onClick={() => setFilter(filter === 'failed' ? 'all' : 'failed')}
          active={filter === 'failed'}
        />
      </section>

      {localOnly.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-xl font-semibold tracking-[0.12em] text-foreground uppercase">Waiting to upload from this device</h2>
          <Card className="divide-y divide-border overflow-hidden">
            {localOnly.map((recording) => (
              <LocalRow key={recording.id} recording={recording} pending={sync.pending[recording.id] ?? 0} />
            ))}
          </Card>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-[0.12em] text-foreground uppercase">All meetings</h2>
            <span className="font-mono text-xl tracking-[0.04em] text-muted-foreground tabular-nums">
              {meetings === null ? '' : filtering ? `${visible.length} of ${total}` : `${total} ${total === 1 ? 'meeting' : 'meetings'}`}
            </span>
          </div>
          <div className="relative w-full max-w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles"
              aria-label="Search meetings"
              className="py-2 pr-9 pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                'rounded-[5px] border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors',
                filter === key
                  ? 'border-foreground/25 bg-secondary font-semibold text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              {label}
              {key === 'progress' && stats.remaining > 0 && (
                <span className={cn('ml-1.5 hidden sm:inline', filter === key ? 'text-foreground/60' : 'text-muted-foreground/70')}>
                  · ~{formatRemaining(stats.remaining)}
                </span>
              )}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort meetings"
              className="rounded-[3px] border border-input bg-card px-2 py-1 font-mono text-[11px] text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none"
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Card className="divide-y divide-border overflow-hidden">
          {meetings === null && !error && (
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-[3px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {meetings === null && error && (
            <div className="px-5 py-12 text-center text-base text-muted-foreground">
              Meetings will appear here once the server is reachable.
            </div>
          )}

          {meetings !== null && visible.length === 0 && (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <div className="grid size-11 place-items-center rounded-md border border-border bg-card text-muted-foreground">
                <Inbox className="size-5" />
              </div>
              {filtering ? (
                <>
                  <p className="mt-3 text-[16px] font-semibold text-foreground">No meetings match</p>
                  <p className="mt-1 text-base text-muted-foreground">Try a different search or filter.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[16px] font-semibold text-foreground">No meetings yet</p>
                  <p className="mt-1 max-w-sm text-base text-muted-foreground">
                    Start a recording and watch the transcript appear live, or upload an audio file you already have.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button asChild>
                      <Link to="/record">
                        <Mic className="size-4" /> New recording
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link to="/upload">
                        <Upload className="size-4" /> Upload audio
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label ?? 'all'} className="divide-y divide-border">
              {group.label && <GroupHeader label={group.label} />}
              {group.items.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  pending={sync.pending[meeting.id] ?? 0}
                  editing={editingId === meeting.id}
                  draft={draft}
                  onDraft={setDraft}
                  onStartRename={() => startRename(meeting)}
                  onCommitRename={() => void commitRename(meeting)}
                  onCancelRename={cancelRename}
                  onDelete={() => setPendingDelete(meeting)}
                />
              ))}
            </div>
          ))}
        </Card>
      </section>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” and its audio will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteMeeting()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
