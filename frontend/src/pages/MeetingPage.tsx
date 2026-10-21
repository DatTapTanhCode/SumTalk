import {
  ArrowLeft,
  Calendar,
  Check,
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
import { AudioPlayer } from '@/components/AudioPlayer'
import { LanguageSelect } from '../components/LanguageSelect'
import { StatusBadge } from '../components/StatusBadge'
import { TranscriptView } from '../components/TranscriptView'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Notice, ProgressBar } from '../components/primitives'
import { useMeeting } from '../hooks/useMeeting'
import { cn, formatBytes, formatClock, formatDateTime, formatDuration } from '../lib/format'
import { languageName } from '../lib/languages'
import { healthStore } from '../lib/server'
import { useStore } from '../lib/store'
import { discardRecording, retryRecording, syncStore } from '../offline/sync'

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-base text-muted-foreground">
      <span className="text-muted-foreground/70">{icon}</span>
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
        className="w-full rounded-md border border-foreground bg-card px-2 py-1 text-[28px] font-bold tracking-[-0.03em] outline-none"
      />
    )
  }
  return (
    <button onClick={() => setEditing(true)} className="group flex w-full min-w-0 items-center gap-2 text-left">
      <h1 className="min-w-0 truncate text-[28px] font-bold tracking-[-0.03em] text-foreground">{meeting.title}</h1>
      <Pencil className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </button>
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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
    </div>
  )
}

/** Shown while the recording only exists on this device (offline, or upload still running). */
function LocalOnly({ id }: { id: string }) {
  const sync = useStore(syncStore)
  const session = useStore(sessionStore)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const recording = sync.recordings.find((r) => r.id === id)
  const pending = sync.pending[id] ?? 0

  if (!recording) {
    return (
      <Card className="px-6 py-16 text-center">
        <p className="font-medium text-foreground">Meeting not found</p>
        <p className="mt-1 text-base text-muted-foreground">It may have been deleted, or the server is unreachable.</p>
        <Link to="/" className="mt-4 inline-block text-base font-medium text-primary hover:underline">
          Back to meetings
        </Link>
      </Card>
    )
  }

  const live = session.meetingId === id
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.03em] text-foreground">{recording.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Meta icon={<Calendar className="size-4" />}>{formatDateTime(recording.meetingAt ?? recording.startedAt)}</Meta>
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
              <Button size="sm" variant="secondary" onClick={() => void retryRecording(id)}>
                Retry
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
                Discard
              </Button>
            </div>
          }
        >
          {recording.error}
        </Notice>
      ) : (
        <Notice
          tone="warning"
          icon={sync.online ? <LoaderCircle className="size-4 animate-spin" /> : <CloudOff className="size-4" />}
          title={live ? 'Recording in progress' : sync.online ? 'Uploading from this device…' : 'Saved on this device'}
        >
          {live
            ? 'This meeting is being recorded in this browser.'
            : sync.online
              ? `${pending} chunk${pending === 1 ? '' : 's'} left to upload. Transcription starts automatically afterwards.`
              : `${pending} chunk${pending === 1 ? '' : 's'} will upload automatically when you are back online. Keep this browser installed and don't clear its data.`}
        </Notice>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              “{recording.title}” will be deleted from this device. It cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await discardRecording(id)
                navigate('/')
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatusPanel({
  meeting,
  kind,
  onRetry,
  onForceFinish,
}: {
  meeting: Meeting
  kind: 'live' | 'final'
  onRetry: () => void
  onForceFinish: () => void
}) {
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
          <Notice
            icon={<Mic className="size-4" />}
            title="Recording in progress"
            action={
              <Link to="/record" className="text-base font-medium text-primary hover:underline">
                Open recorder
              </Link>
            }
          >
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
          action={
            <Button size="sm" variant="secondary" onClick={onForceFinish}>
              Finish now
            </Button>
          }
        >
          It is being recorded elsewhere, or the recording device went away. Finish now to transcribe what was received.
        </Notice>
      )
    case 'uploading':
      return (
        <Notice icon={<LoaderCircle className="size-4 animate-spin" />} title="Upload not finished">
          The file upload was interrupted before it completed.
        </Notice>
      )
    case 'queued':
    case 'processing':
      return (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-base font-medium text-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            {meeting.status === 'queued' ? 'Waiting in the queue…' : 'Converting audio to the standard format…'}
          </div>
          <ProgressBar indeterminate />
        </Card>
      )
    case 'transcribing':
      return (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="size-4 text-primary" />
              {stt?.status === 'loading' ? 'Loading the speech model…' : kind === 'live' ? 'Improving the transcript…' : 'Transcribing…'}
            </span>
            <span className="font-mono text-muted-foreground tabular-nums">{Math.round(meeting.progress * 100)}%</span>
          </div>
          <ProgressBar value={meeting.progress} />
          {kind === 'live' && <p className="text-xl text-muted-foreground">Showing the live draft until the accurate full-file transcript is ready.</p>}
        </Card>
      )
    case 'failed':
      return (
        <Notice
          tone="error"
          icon={<CircleAlert className="size-4" />}
          title="Processing failed"
          action={
            meeting.has_audio ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RefreshCw className="size-3.5" /> Retry
              </Button>
            ) : undefined
          }
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

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: 'txt', label: 'Text (.txt)' },
  { format: 'srt', label: 'Subtitles (.srt)' },
  { format: 'vtt', label: 'WebVTT (.vtt)' },
  { format: 'json', label: 'JSON (.json)' },
]

function ComingSoon({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-not-allowed">
          <TabsTrigger value={label} disabled>
            {children}
            <sup className="text-[10px]">v2</sup>
          </TabsTrigger>
        </span>
      </TooltipTrigger>
      <TooltipContent>Not built yet — planned for version 2</TooltipContent>
    </Tooltip>
  )
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
  const [retranscribing, setRetranscribing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // The sync engine just finished uploading/finalizing this recording: show the new status now.
  useEffect(() => {
    if (!onDevice) void refresh()
  }, [onDevice, refresh])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
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
    setConfirmingDelete(false)
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

  const source = meeting.source === 'upload'
    ? (meeting.original_filename ?? 'Uploaded file')
    : meeting.capture_mode === 'mic+system'
      ? 'Mic + meeting audio'
      : 'Microphone'

  const deleteButton = (className?: string) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn('justify-start text-live hover:bg-live-soft hover:text-live', className)}
      onClick={() => setConfirmingDelete(true)}
    >
      <Trash2 className="size-4" /> Delete meeting
    </Button>
  )

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All meetings
      </Link>

      <div className="space-y-2">
        <EditableTitle key={meeting.title} meeting={meeting} onSaved={setMeeting} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <StatusBadge status={meeting.status} progress={meeting.progress} />
          <Meta icon={meeting.source === 'upload' ? <FileAudio className="size-4" /> : <Mic className="size-4" />}>{source}</Meta>
          <Meta icon={<Calendar className="size-4" />}>{formatDateTime(meeting.meeting_at ?? meeting.created_at)}</Meta>
          {meeting.duration_sec > 0 && <Meta icon={<Clock className="size-4" />}>{formatDuration(meeting.duration_sec)}</Meta>}
          {language && (
            <Meta icon={<Languages className="size-4" />}>
              {spoken.length > 1 ? spoken.map(languageName).join(' + ') : languageName(language)}
              {!meeting.language && (
                <span className="text-muted-foreground/70">
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
      {actionError && (
        <Notice tone="error" icon={<CircleAlert className="size-4" />}>
          {actionError}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {meeting.has_audio && (
            <AudioPlayer
              audioRef={audioRef}
              src={api.audioUrl(meeting.id)}
              currentTime={currentTime}
              durationSec={meeting.duration_sec}
              playing={playing}
              onTimeUpdate={setCurrentTime}
              onPlayingChange={setPlaying}
            />
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4">
              <Tabs value="transcript">
                <TabsList>
                  <TabsTrigger value="transcript">
                    Transcript
                    {transcript.kind === 'live' && <span className="ml-1 text-xl font-normal text-live">live draft</span>}
                  </TabsTrigger>
                  <ComingSoon label="translation">Translation</ComingSoon>
                  <ComingSoon label="summary">Summary</ComingSoon>
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search transcript"
                    aria-label="Search transcript"
                    className="w-44 py-1.5 pl-9 sm:w-48"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={copy} disabled={!transcript.segments.length} aria-label="Copy transcript">
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Download className="size-4" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {EXPORTS.map(({ format, label }) => (
                      <DropdownMenuItem key={format} asChild>
                        <a href={api.exportUrl(meeting.id, format)} download className="gap-2">
                          <FileText className="size-4 text-muted-foreground" />
                          {label}
                        </a>
                      </DropdownMenuItem>
                    ))}
                    {meeting.has_audio && (
                      <DropdownMenuItem asChild>
                        <a href={api.audioUrl(meeting.id, true)} download className="gap-2">
                          <FileAudio className="size-4 text-muted-foreground" /> Audio (.wav)
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {meeting.has_audio && !busy && (
                  <Button variant="secondary" size="sm" onClick={() => setRetranscribing(true)}>
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">Re-transcribe</span>
                  </Button>
                )}
              </div>
            </div>
            <div
              data-scroll
              className="max-h-[65vh] overflow-y-auto px-1 py-3 lg:max-h-[calc(100dvh-17rem)] sm:px-2"
            >
              <TranscriptView
                segments={transcript.segments}
                partial={transcript.partial}
                mainLanguage={language}
                currentTime={meeting.has_audio ? currentTime : undefined}
                playing={playing}
                onSeek={meeting.has_audio ? seek : undefined}
                query={query}
                follow={transcript.kind === 'live'}
                empty={
                  <div className="px-6 py-14 text-center text-base text-muted-foreground">
                    {busy ? 'The transcript will appear here as soon as the first words are recognized.' : 'No speech was recognized in this audio.'}
                  </div>
                }
              />
            </div>
          </Card>

          <div className="lg:hidden">{deleteButton()}</div>
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-16 lg:block">
          <Card className="p-4">
            <h2 className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Details</h2>
            <dl className="mt-3 space-y-2.5 text-base">
              <Detail label="Source">{source}</Detail>
              <Detail label="Duration">{formatDuration(meeting.duration_sec)}</Detail>
              {meeting.meeting_at && <Detail label="Meeting">{formatDateTime(meeting.meeting_at)}</Detail>}
              <Detail label="Created">{formatDateTime(meeting.created_at)}</Detail>
              {meeting.completed_at && <Detail label="Finished">{formatDateTime(meeting.completed_at)}</Detail>}
              {meeting.size_bytes ? <Detail label="Size">{formatBytes(meeting.size_bytes)}</Detail> : null}
              {meeting.total_chunks ? <Detail label="Chunks">{`${meeting.received_chunks} / ${meeting.total_chunks}`}</Detail> : null}
              {language && (
                <Detail label="Language">
                  {languageName(language)}
                  {!meeting.language && meeting.language_probability
                    ? ` · ${Math.round(meeting.language_probability * 100)}%`
                    : ''}
                </Detail>
              )}
            </dl>
          </Card>

          <Card className="border-live/30 p-4">
            <h2 className="font-mono text-[10px] tracking-[0.14em] text-live uppercase">Danger zone</h2>
            <p className="mt-2 text-xl text-muted-foreground">Deleting removes the audio and transcript permanently.</p>
            <div className="mt-3">{deleteButton('w-full')}</div>
          </Card>
        </aside>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>“{meeting.title}” and its audio will be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={retranscribing} onOpenChange={setRetranscribing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transcribe again</DialogTitle>
            <DialogDescription>
              Useful when the spoken language was detected incorrectly. The existing transcript will be replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="retry-language" className="text-base font-medium text-foreground">
              Spoken language
            </label>
            <LanguageSelect id="retry-language" value={retryLanguage} onChange={setRetryLanguage} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRetranscribing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setRetranscribing(false)
                void retranscribe(retryLanguage)
              }}
            >
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
