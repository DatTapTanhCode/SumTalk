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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Notice, PageHeader } from '@/components/primitives'
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

/** Columns of the desktop table: name | date | duration | language | status | actions. */
const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_10rem_5.5rem_7rem_9rem_2rem] md:items-center md:gap-4'

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
          className="relative z-20 shrink-0 text-muted-foreground opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
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

function SourceIcon({ source, className }: { source: 'upload' | 'record' | 'local'; className?: string }) {
  const Icon = source === 'upload' ? FileAudio : source === 'local' ? CloudOff : Mic
  return (
    <div
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-[3px] border border-border bg-background',
        source === 'record' ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-4" />
    </div>
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
  const when = meetingTime(meeting)

  return (
    <div className={cn('group row-rule relative flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 sm:px-5', ROW_GRID)}>
      {!editing && (
        <Link
          to={`/meetings/${meeting.id}`}
          aria-label={`Open ${meeting.title}`}
          className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground"
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SourceIcon source={meeting.source === 'upload' ? 'upload' : 'record'} />
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
          {/* On phones the columns collapse into one meta line. */}
          <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase md:hidden">
            <span>{formatDateTime(when)}</span>
            {meeting.duration_sec > 0 && <span>· {formatDuration(meeting.duration_sec)}</span>}
            {language && <span>· {languageName(language)}</span>}
          </div>
          {pending > 0 && <div className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">{pending} chunks on device</div>}
        </div>
      </div>
      <div className="hidden truncate font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase md:block">{formatDateTime(when)}</div>
      <div className="digital hidden text-[18px] leading-none text-foreground md:block">
        {meeting.duration_sec > 0 ? formatDuration(meeting.duration_sec) : '—'}
      </div>
      <div className="hidden truncate font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase md:block">{language ? languageName(language) : '—'}</div>
      <div className="flex flex-col items-end gap-0.5 md:items-start">
        <StatusBadge status={meeting.status} progress={meeting.progress} />
        {remaining !== null && <span className="font-mono text-[10px] tracking-[0.06em] text-foreground uppercase">~{formatRemaining(remaining)} left</span>}
      </div>
      {editing ? <span /> : <RowActions meeting={meeting} onRename={onStartRename} onDelete={onDelete} />}
    </div>
  )
}

function LocalRow({ recording, pending }: { recording: LocalRecording; pending: number }) {
  return (
    <Link
      to={`/meetings/${recording.id}`}
      className={cn('row-rule flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 sm:px-5', ROW_GRID)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SourceIcon source="local" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-foreground">{recording.title}</div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
            {pending} chunks waiting
            {recording.error && <span className="text-live"> · {recording.error}</span>}
          </div>
        </div>
      </div>
      <div className="hidden truncate font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase md:block">{formatDateTime(recording.meetingAt ?? recording.startedAt)}</div>
      <div className="digital hidden text-[18px] leading-none text-foreground md:block">{formatDuration(recording.totalSamples / 16000)}</div>
      <div className="hidden font-mono text-[11px] text-muted-foreground md:block">—</div>
      <StatusBadge status="local" />
      <span className="hidden md:block" />
    </Link>
  )
}

function TableHead() {
  return (
    <div className={cn('hidden border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:px-5', ROW_GRID)}>
      <div className="pl-12">Name</div>
      <div>Date</div>
      <div>Duration</div>
      <div>Language</div>
      <div>Status</div>
      <div />
    </div>
  )
}

function GroupHeader({ label }: { label: string }) {
  return <div className="border-b border-border bg-secondary/60 px-4 py-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:px-5">{label}</div>
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

  const counts = useMemo(() => {
    const list = meetings ?? []
    const busy = list.filter((m) => BUSY_STATUSES.includes(m.status))
    return {
      all: list.length,
      transcribed: list.filter((m) => m.status === 'done').length,
      progress: busy.length,
      failed: list.filter((m) => m.status === 'failed').length,
      recorded: list.reduce((sum, m) => sum + (m.duration_sec || 0), 0),
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Library"
        title="Meetings"
        description={
          meetings && total > 0
            ? `${total} ${total === 1 ? 'meeting' : 'meetings'} · ${formatDuration(counts.recorded)} of audio`
            : 'Record or upload a meeting and get the transcript in the language it was spoken.'
        }
        actions={
          <>
            <Button asChild variant="secondary" size="lg">
              <Link to="/upload">
                <Upload className="size-4" /> Upload audio
              </Link>
            </Button>
            <Button asChild size="lg" className="md:hidden">
              <Link to="/record">
                <Mic className="size-4" /> Record
              </Link>
            </Button>
          </>
        }
      />

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

      {localOnly.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-foreground uppercase">Waiting to upload from this device</h2>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {localOnly.map((recording) => (
              <LocalRow key={recording.id} recording={recording} pending={sync.pending[recording.id] ?? 0} />
            ))}
          </div>
        </section>
      )}

      <section>
        {/* Filter tabs with counts, then search + sort - the way file and issue lists do it. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border">
          <div className="-mb-px flex gap-5 overflow-x-auto" role="group" aria-label="Filter meetings">
            {FILTERS.map(({ key, label }) => {
              const count = meetings === null ? null : counts[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-0.5 pb-2.5 font-mono text-[11px] tracking-[0.1em] whitespace-nowrap uppercase transition-colors',
                    filter === key
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {count !== null && (
                    <span
                      className={cn(
                        'digital text-[17px] leading-none tracking-normal',
                        key === 'failed' && count > 0 ? 'text-live' : filter === key ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex w-full items-center gap-2 pb-2.5 sm:w-auto">
            <div className="relative flex-1 sm:w-60 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles"
                aria-label="Search meetings"
                className="py-1.5 pr-9 pl-9"
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
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort meetings"
              className="h-[38px] rounded-md border border-input bg-card px-2 font-mono text-[11px] text-foreground uppercase focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none"
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filter === 'progress' && counts.remaining > 0 && (
          <p className="mt-3 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">~{formatRemaining(counts.remaining)} of transcription left</p>
        )}

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {meetings !== null && visible.length > 0 && <TableHead />}

          {meetings === null && !error && (
            <div className="space-y-4 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-[3px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {meetings === null && error && (
            <div className="px-5 py-12 text-center text-base text-muted-foreground">Meetings will appear here once the server is reachable.</div>
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
            <div key={group.label ?? 'all'} className="border-b border-border last:border-b-0">
              {group.label && <GroupHeader label={group.label} />}
              <div className="divide-y divide-border">
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
            </div>
          ))}
        </div>
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
