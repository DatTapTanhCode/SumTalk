import { CloudOff, FileAudio, Inbox, Mic, Search, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../api/client'
import type { Meeting } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { Card, Notice, inputClass, linkButton } from '../components/ui'
import { cn, formatDateTime, formatDuration } from '../lib/format'
import { languageName } from '../lib/languages'
import { useStore } from '../lib/store'
import type { LocalRecording } from '../offline/db'
import { syncStore } from '../offline/sync'

function MeetingRow({ meeting, pending }: { meeting: Meeting; pending: number }) {
  const language = meeting.language ?? meeting.detected_language
  return (
    <Link to={`/meetings/${meeting.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
      <div
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl',
          meeting.source === 'upload' ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600',
        )}
      >
        {meeting.source === 'upload' ? <FileAudio className="size-5" /> : <Mic className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{meeting.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
          <span>{formatDateTime(meeting.created_at)}</span>
          {meeting.duration_sec > 0 && <span>· {formatDuration(meeting.duration_sec)}</span>}
          {language && <span>· {languageName(language)}</span>}
        </div>
      </div>
      {pending > 0 && (
        <span className="hidden rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700 ring-1 ring-orange-200 sm:inline">
          {pending} chunks on device
        </span>
      )}
      <StatusBadge status={meeting.status} progress={meeting.progress} />
    </Link>
  )
}

function LocalRow({ recording, pending }: { recording: LocalRecording; pending: number }) {
  return (
    <Link to={`/meetings/${recording.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
        <CloudOff className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{recording.title}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {formatDateTime(recording.startedAt)} · {formatDuration(recording.totalSamples / 16000)} · {pending} chunks waiting
          {recording.error && <span className="text-red-600"> · {recording.error}</span>}
        </div>
      </div>
      <StatusBadge status="local" />
    </Link>
  )
}

export function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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
  const filtered = (meetings ?? []).filter((m) => m.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">Record or upload a meeting and get the transcript in the language it was spoken.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload" className={linkButton.secondary}>
            <Upload className="size-4" /> Upload audio
          </Link>
          <Link to="/record" className={linkButton.primary}>
            <Mic className="size-4" /> New recording
          </Link>
        </div>
      </div>

      {error && (
        <Notice tone="warning" title="Can't load meetings from the server">
          {error}. Recordings made now are kept on this device and upload when the server is reachable.
        </Notice>
      )}

      {localOnly.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Waiting to upload from this device</h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {localOnly.map((recording) => (
              <LocalRow key={recording.id} recording={recording} pending={sync.pending[recording.id] ?? 0} />
            ))}
          </Card>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-500">All meetings</h2>
          <div className="relative w-full max-w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles" className={cn(inputClass, 'py-2 pl-9')} />
          </div>
        </div>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {meetings === null && !error && <div className="px-5 py-10 text-center text-sm text-slate-400">Loading…</div>}
          {meetings !== null && filtered.length === 0 && (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Inbox className="size-6" />
              </div>
              <p className="mt-3 font-medium text-slate-700">{query ? 'No meetings match your search' : 'No meetings yet'}</p>
              {!query && <p className="mt-1 text-sm text-slate-500">Start a recording or upload an audio file to get a transcript.</p>}
            </div>
          )}
          {filtered.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} pending={sync.pending[meeting.id] ?? 0} />
          ))}
        </Card>
      </section>
    </div>
  )
}
