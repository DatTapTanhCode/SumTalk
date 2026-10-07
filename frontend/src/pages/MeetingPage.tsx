import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  CloudOff,
  Copy,
  Download,
  FileAudio,
  FileText,
  Languages,
  LoaderCircle,
  Mic,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage } from '../api/client'
import type { ExportFormat, Meeting, Segment } from '../api/types'
import { sessionStore } from '../audio/session'
import { LanguageSelect } from '../components/LanguageSelect'
import { StatusBadge } from '../components/StatusBadge'
import { TranscriptView } from '../components/TranscriptView'
import { Button, Card, Notice, ProgressBar, inputClass } from '../components/ui'
import { useMeeting } from '../hooks/useMeeting'
import { cn, formatClock, formatDateTime, formatDuration } from '../lib/format'
import { languageName } from '../lib/languages'
import { healthStore } from '../lib/server'
import { useStore } from '../lib/store'
import { discardRecording, retryRecording, syncStore } from '../offline/sync'

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
      <span className="text-slate-400">{icon}</span>
      {children}
    </span>
  )
}

function EditableTitle({ meeting, onSaved }: { meeting: Meeting; onSaved: (m: Meeting) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(meeting.title)

  const save = async () => {
    setEditing(false)
    const title = value.trim()
    if (!title || title === meeting.title) return setValue(meeting.title)
    try {
      onSaved(await api.renameMeeting(meeting.id, title))
    } catch {
      setValue(meeting.title)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') {
            setValue(meeting.title)
            setEditing(false)
          }
        }}
        className={cn(inputClass, 'text-xl font-semibold')}
      />
    )
  }
  return (
    <button onClick={() => setEditing(true)} className="group flex min-w-0 items-center gap-2 text-left">
      <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{meeting.title}</h1>
      <Pencil className="size-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
    </button>
  )
}

function Dropdown({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="size-3.5 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">{children}</div>
    </details>
  )
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
  return Promise.resolve()
}

/** Shown while the recording only exists on this device (offline, or upload still running). */
function LocalOnly({ id }: { id: string }) {
  const sync = useStore(syncStore)
  const session = useStore(sessionStore)
  const navigate = useNavigate()
  const recording = sync.recordings.find((r) => r.id === id)
  const pending = sync.pending[id] ?? 0

  if (!recording) {
    return (
      <Card className="px-6 py-16 text-center">
        <p className="font-medium text-slate-700">Meeting not found</p>
        <p className="mt-1 text-sm text-slate-500">It may have been deleted, or the server is unreachable.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to meetings
        </Link>
      </Card>
    )
  }

  const live = session.meetingId === id
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{recording.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Meta icon={<Calendar className="size-4" />}>{formatDateTime(recording.startedAt)}</Meta>
          <Meta icon={<Clock className="size-4" />}>{formatDuration(recording.totalSamples / 16000)}</Meta>
          <StatusBadge status="local" />
        </div>
      </div>
      {recording.error ? (
        <Notice
          tone="error"
          icon={<CircleAlert className="size-4" />}
          title="The server refused this recording"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void retryRecording(id)}>Retry</Button>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (confirm('Delete this recording from the device? It cannot be recovered.')) {
                    await discardRecording(id)
                    navigate('/')
                  }
                }}
              >
                Discard
              </Button>
            </div>
          }
        >
          {recording.error}
        </Notice>
      ) : (
        <Notice tone="warning" icon={sync.online ? <LoaderCircle className="size-4 animate-spin" /> : <CloudOff className="size-4" />} title={live ? 'Recording in progress' : sync.online ? 'Uploading from this device…' : 'Saved on this device'}>
          {live
            ? 'This meeting is being recorded in this browser.'
            : sync.online
              ? `${pending} chunk${pending === 1 ? '' : 's'} left to upload. Transcription starts automatically afterwards.`
              : `${pending} chunk${pending === 1 ? '' : 's'} will upload automatically when you are back online. Keep this browser installed and don't clear its data.`}
        </Notice>
      )}
    </div>
  )
}

function StatusPanel({ meeting, kind, onRetry, onForceFinish }: { meeting: Meeting; kind: 'live' | 'final'; onRetry: () => void; onForceFinish: () => void }) {
  const session = useStore(sessionStore)
  const sync = useStore(syncStore)
  const { stt } = useStore(healthStore)
  const pending = sync.pending[meeting.id] ?? 0
  const recordingHere = session.meetingId === meeting.id
  const uploadingHere = sync.recordings.some((r) => r.id === meeting.id)

  switch (meeting.status) {
    case 'recording':
      if (recordingHere) {
        return (
          <Notice icon={<Mic className="size-4" />} title="Recording in progress" action={<Link to="/record" className="text-sm font-medium text-indigo-700 hover:underline">Open recorder</Link>}>
            The transcript below updates live.
          </Notice>
        )
      }
      if (uploadingHere) {
        return (
          <Notice tone="warning" icon={<LoaderCircle className="size-4 animate-spin" />} title="Uploading the recording">
            {pending} chunk{pending === 1 ? '' : 's'} left on this device. The final transcript starts right after.
          </Notice>
        )
      }
      if (Date.now() - Date.parse(meeting.updated_at) < 20_000) {
        return (
          <Notice icon={<LoaderCircle className="size-4 animate-spin" />} title="Receiving audio">
            This meeting is being recorded on another device or tab.
          </Notice>
        )
      }
      return (
        <Notice
          tone="warning"
          icon={<CircleAlert className="size-4" />}
          title="Still marked as recording"
          action={<Button size="sm" variant="secondary" onClick={onForceFinish}>Finish now</Button>}
        >
          It is being recorded elsewhere, or the recording device went away. Finish now to transcribe what was received.
        </Notice>
      )
    case 'uploading':
      return <Notice icon={<LoaderCircle className="size-4 animate-spin" />} title="Upload not finished">The file upload was interrupted before it completed.</Notice>
    case 'queued':
    case 'processing':
      return (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <LoaderCircle className="size-4 animate-spin text-indigo-500" />
            {meeting.status === 'queued' ? 'Waiting in the queue…' : 'Converting audio to the standard format…'}
          </div>
          <ProgressBar indeterminate />
        </Card>
      )
    case 'transcribing':
      return (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <Sparkles className="size-4 text-indigo-500" />
              {stt?.status === 'loading' ? 'Loading the speech model…' : kind === 'live' ? 'Improving the transcript…' : 'Transcribing…'}
            </span>
            <span className="font-mono text-slate-500 tabular-nums">{Math.round(meeting.progress * 100)}%</span>
          </div>
          <ProgressBar value={meeting.progress} />
          {kind === 'live' && <p className="text-xs text-slate-500">Showing the live draft until the accurate full-file transcript is ready.</p>}
        </Card>
      )
    case 'failed':
      return (
        <Notice
          tone="error"
          icon={<CircleAlert className="size-4" />}
          title="Processing failed"
          action={meeting.has_audio ? <Button size="sm" variant="secondary" onClick={onRetry}><RefreshCw className="size-3.5" /> Retry</Button> : undefined}
        >
          {meeting.error}
        </Notice>
      )
    default:
      return null
  }
}

function transcriptText(meeting: Meeting, segments: Segment[]): string {
  return `${meeting.title}\n\n` + segments.map((s) => `[${formatClock(s.start)}] ${s.text}`).join('\n')
}

export function MeetingPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { meeting, setMeeting, transcript, notOnServer, loaded, refresh, restart } = useMeeting(id)
  const onDevice = useStore(syncStore).recordings.some((r) => r.id === id)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [retryLanguage, setRetryLanguage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // The sync engine just finished uploading/finalizing this recording: show the new status now.
  useEffect(() => {
    if (!onDevice) void refresh()
  }, [onDevice, refresh])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    )
  }
  if (!meeting || notOnServer) return <LocalOnly id={id} />

  const language = meeting.language ?? meeting.detected_language
  const spoken = [...new Set(transcript.segments.map((s) => s.language).filter((l): l is string => Boolean(l)))]
  const busy = ['recording', 'uploading', 'queued', 'processing', 'transcribing'].includes(meeting.status)

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    void audio.play()
  }

  const run = async (action: () => Promise<Meeting>) => {
    setActionError(null)
    try {
      restart(await action())
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  const retranscribe = (lang: string | null) => run(() => api.retranscribe(meeting.id, lang))

  const remove = async () => {
    if (!confirm(`Delete "${meeting.title}" and its audio? This cannot be undone.`)) return
    try {
      await api.deleteMeeting(meeting.id)
      navigate('/')
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  const copy = async () => {
    await copyText(transcriptText(meeting, transcript.segments))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> All meetings
      </Link>

      <div className="space-y-2">
        <EditableTitle key={meeting.title} meeting={meeting} onSaved={setMeeting} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <StatusBadge status={meeting.status} progress={meeting.progress} />
          <Meta icon={meeting.source === 'upload' ? <FileAudio className="size-4" /> : <Mic className="size-4" />}>
            {meeting.source === 'upload' ? meeting.original_filename : meeting.capture_mode === 'mic+system' ? 'Recorded · mic + meeting audio' : 'Recorded · microphone'}
          </Meta>
          <Meta icon={<Calendar className="size-4" />}>{formatDateTime(meeting.created_at)}</Meta>
          {meeting.duration_sec > 0 && <Meta icon={<Clock className="size-4" />}>{formatDuration(meeting.duration_sec)}</Meta>}
          {language && (
            <Meta icon={<Languages className="size-4" />}>
              {spoken.length > 1 ? spoken.map(languageName).join(' + ') : languageName(language)}
              {!meeting.language && (
                <span className="text-slate-400">
                  (auto-detected{spoken.length <= 1 && meeting.language_probability ? ` ${Math.round(meeting.language_probability * 100)}%` : ''})
                </span>
              )}
            </Meta>
          )}
        </div>
      </div>

      <StatusPanel
        meeting={meeting}
        kind={transcript.kind}
        onRetry={() => void retranscribe(meeting.language)}
        onForceFinish={() => void run(() => api.finalize(meeting.id))}
      />
      {actionError && <Notice tone="error" icon={<CircleAlert className="size-4" />}>{actionError}</Notice>}

      {meeting.has_audio && (
        <Card className="p-3">
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={api.audioUrl(meeting.id)}
            className="w-full"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
            <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm">
              Transcript{transcript.kind === 'live' && <span className="ml-1.5 text-xs font-normal text-rose-600">live draft</span>}
            </span>
            <span title="Planned for v2" className="cursor-not-allowed px-3 py-1.5 text-slate-400">
              Translation <sup className="text-[10px]">v2</sup>
            </span>
            <span title="Planned for v2" className="cursor-not-allowed px-3 py-1.5 text-slate-400">
              Summary <sup className="text-[10px]">v2</sup>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={cn(inputClass, 'w-36 py-2 pl-9 sm:w-44')} />
            </div>
            <Button variant="secondary" size="sm" className="py-2" onClick={copy} disabled={!transcript.segments.length} title="Copy transcript">
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
            <Dropdown label="Export" icon={<Download className="size-4" />}>
              {(['txt', 'srt', 'vtt', 'json'] as ExportFormat[]).map((format) => (
                <a key={format} href={api.exportUrl(meeting.id, format)} download className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <FileText className="size-4 text-slate-400" />
                  {format === 'txt' ? 'Text (.txt)' : format === 'srt' ? 'Subtitles (.srt)' : format === 'vtt' ? 'WebVTT (.vtt)' : 'JSON (.json)'}
                </a>
              ))}
              {meeting.has_audio && (
                <a href={api.audioUrl(meeting.id, true)} download className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <FileAudio className="size-4 text-slate-400" /> Audio (.wav)
                </a>
              )}
            </Dropdown>
            {meeting.has_audio && !busy && (
              <Dropdown label="Re-transcribe" icon={<RefreshCw className="size-4" />}>
                <div className="space-y-2 p-1">
                  <p className="text-xs text-slate-500">Transcribe again, e.g. when the language was detected wrong.</p>
                  <LanguageSelect value={retryLanguage} onChange={setRetryLanguage} />
                  <Button size="sm" className="w-full" onClick={() => void retranscribe(retryLanguage)}>Start</Button>
                </div>
              </Dropdown>
            )}
          </div>
        </div>
        <div className="px-1 py-3 sm:px-2">
          <TranscriptView
            segments={transcript.segments}
            partial={transcript.partial}
            mainLanguage={language}
            currentTime={meeting.has_audio ? currentTime : undefined}
            playing={playing}
            onSeek={meeting.has_audio ? seek : undefined}
            query={query}
            empty={
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                {busy ? 'The transcript will appear here as soon as the first words are recognized.' : 'No speech was recognized in this audio.'}
              </div>
            }
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={remove}>
          <Trash2 className="size-4" /> Delete meeting
        </Button>
      </div>
    </div>
  )
}
