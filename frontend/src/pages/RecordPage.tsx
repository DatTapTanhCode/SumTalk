import { AudioLines, CircleAlert, HardDrive, Info, Mic, MonitorSpeaker, Pause, Play, Smartphone, Square, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { CaptureMode } from '../api/types'
import { canCaptureMeetingAudio, recordingUnsupportedReason } from '../audio/recorder'
import {
  clearSessionError,
  getAnalyser,
  pauseRecording,
  resumeRecording,
  sessionStore,
  startRecording,
  stopRecording,
} from '../audio/session'
import { LanguageSelect } from '../components/LanguageSelect'
import { LevelMeter } from '../components/LevelMeter'
import { TranscriptDemo } from '../components/TranscriptDemo'
import { TranscriptView } from '../components/TranscriptView'
import { DatePicker } from '../components/DatePicker'
import { Card } from '@/components/ui/card'
import { Notice, inputClass } from '../components/primitives'
import { useMeeting } from '../hooks/useMeeting'
import { useWakeLock } from '../hooks/useWakeLock'
import { cn, defaultMeetingTitle, formatClock } from '../lib/format'
import { languageName } from '../lib/languages'
import { configStore, healthStore } from '../lib/server'
import { useStore } from '../lib/store'
import { syncStore } from '../offline/sync'

const LANGUAGE_KEY = 'sumtalk.language'

function SourceOption({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'border-foreground bg-background' : 'border-border bg-card hover:bg-secondary/50',
      )}
    >
      <div
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-[3px] border',
          selected ? 'border-foreground bg-foreground text-primary-foreground' : 'border-border bg-background text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-[15px] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</div>
      </div>
    </button>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-start gap-2.5 bg-card px-3 py-2.5">
      <div className={cn('mt-0.5', tone === 'warn' ? 'text-live' : 'text-muted-foreground')}>{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
        <div className={cn('mt-1 truncate text-[14px] font-semibold', tone === 'warn' ? 'text-live' : 'text-foreground')}>{value}</div>
      </div>
    </div>
  )
}

/** Live transcript of the meeting being recorded (polled from the server). */
function LivePanel({ meetingId }: { meetingId: string }) {
  const { meeting, transcript, notOnServer } = useMeeting(meetingId)
  const sync = useStore(syncStore)
  const { reachable } = useStore(healthStore)
  const offline = !sync.online || reachable === false
  const language = meeting?.language ?? meeting?.detected_language

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-[1px] bg-live opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-[1px] bg-live" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-foreground uppercase">Live transcript</span>
        </div>
        {language && (
          <span className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
            {languageName(language)}
            {!meeting?.language && ' · auto'}
          </span>
        )}
      </div>
      <div data-scroll className="min-h-0 flex-1 overflow-y-auto px-1 py-3">
        {offline || notOnServer ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-base text-muted-foreground">
            <HardDrive className="mb-3 size-7 text-muted-foreground/50" />
            {offline
              ? 'You are offline. Audio keeps being saved on this device; the transcript appears once it is uploaded.'
              : 'Connecting to the server…'}
          </div>
        ) : (
          <TranscriptView
            segments={transcript.segments}
            partial={transcript.partial}
            mainLanguage={language}
            follow
            empty={
              <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center text-base text-muted-foreground">
                <AudioLines className="mb-3 size-7 text-muted-foreground/50" />
                Start speaking. Text appears here a few seconds after it is said.
              </div>
            }
          />
        )}
      </div>
    </>
  )
}

export function RecordPage() {
  const session = useStore(sessionStore)
  const sync = useStore(syncStore)
  const config = useStore(configStore)
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [meetingAt, setMeetingAt] = useState(() => new Date())
  const [language, setLanguage] = useState<string | null>(() => localStorage.getItem(LANGUAGE_KEY))
  const [mode, setMode] = useState<CaptureMode>('mic')

  const unsupported = recordingUnsupportedReason()
  const meetingAudio = canCaptureMeetingAudio()
  const recording = session.phase === 'recording' || session.phase === 'paused' || session.phase === 'stopping'
  const wakeLock = useWakeLock(session.phase === 'recording' || session.phase === 'paused')
  const pending = session.meetingId ? (sync.pending[session.meetingId] ?? 0) : 0
  const uploaded = Math.max(0, session.chunks - pending)

  const start = () => {
    if (language) localStorage.setItem(LANGUAGE_KEY, language)
    else localStorage.removeItem(LANGUAGE_KEY)
    void startRecording({
      title: title.trim() || defaultMeetingTitle(meetingAt),
      language,
      captureMode: mode,
      meetingAt: meetingAt.toISOString(),
    })
  }

  const stop = async () => {
    const id = await stopRecording()
    setTitle('')
    setMeetingAt(new Date())
    if (id) navigate(`/meetings/${id}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="panel-ticks h-fit p-5 sm:p-6">
        {!recording ? (
          <div className="space-y-5">
            <div>
              <div className="eyebrow">Recorder / 01</div>
              <h1 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-foreground">New recording</h1>
              <p className="mt-1 text-base text-muted-foreground">
                Audio is saved on this device first and uploaded every {config.chunk_seconds} seconds, so nothing is lost if
                the connection drops.
              </p>
            </div>

            {unsupported && <Notice tone="error" icon={<CircleAlert className="size-4" />}>{unsupported}</Notice>}
            {session.error && (
              <Notice
                tone="error"
                icon={<CircleAlert className="size-4" />}
                action={
                  <button onClick={clearSessionError} className="text-live/70 hover:text-live" aria-label="Dismiss">
                    <X className="size-4" />
                  </button>
                }
              >
                {session.error}
              </Notice>
            )}

            <div className="space-y-1.5">
              <label htmlFor="title" className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Title</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultMeetingTitle(meetingAt)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="meeting-at" className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Date
              </label>
              <DatePicker id="meeting-at" value={meetingAt} onChange={setMeetingAt} />
              <p className="text-[11px] text-muted-foreground">When the meeting took place. Defaults to today.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="language" className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Spoken language</label>
              <LanguageSelect id="language" value={language} onChange={setLanguage} />
              <p className="text-[11px] text-muted-foreground">Auto-detect handles mixed languages. Choose one if detection guesses wrong.</p>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Audio source</div>
              <SourceOption
                selected={mode === 'mic'}
                onSelect={() => setMode('mic')}
                icon={<Mic className="size-4" />}
                title="Microphone"
                description="In-person meetings, or calls on loudspeaker."
              />
              <SourceOption
                selected={mode === 'mic+system'}
                disabled={!meetingAudio}
                onSelect={() => setMode('mic+system')}
                icon={<MonitorSpeaker className="size-4" />}
                title="Microphone + meeting audio"
                description={
                  meetingAudio
                    ? 'Online meetings: also records what others say in the Meet / Teams / Zoom tab.'
                    : 'Needs desktop Chrome or Edge.'
                }
              />
              {mode === 'mic+system' && (
                <Notice icon={<Info className="size-4" />}>
                  When the browser asks, pick the meeting tab (or <b>Entire screen</b>) and turn on <b>Share tab audio</b> /{' '}
                  <b>Share system audio</b>.
                </Notice>
              )}
            </div>

            <button
              onClick={start}
              disabled={Boolean(unsupported) || session.phase === 'starting'}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-md bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-40"
            >
              <span className="grid size-5 place-items-center rounded-[2px] border border-primary-foreground/40">
                <span className="size-2 rounded-[1px] bg-primary-foreground" />
              </span>
              {session.phase === 'starting' ? 'Starting…' : 'Start recording'}
            </button>
            <p className="text-center font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
              <Smartphone className="mr-1 inline size-3 -translate-y-px" />
              On a phone, keep this screen open - it stays awake while recording.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase',
                  session.phase === 'recording' ? 'border-live/40 bg-live-soft text-live' : 'border-border bg-secondary text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-[1px]',
                    session.phase === 'recording' ? 'animate-pulse bg-live' : 'bg-muted-foreground',
                  )}
                />
                {session.phase === 'recording' ? 'Recording' : session.phase === 'paused' ? 'Paused' : 'Saving…'}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                {session.captureMode === 'mic' ? <Mic className="size-3" /> : <MonitorSpeaker className="size-3" />}
                {session.captureMode === 'mic' ? 'Mic' : 'Mic + meeting audio'}
              </span>
            </div>

            <div className="text-center">
              <div data-testid="timer" className="digital text-[72px] font-medium leading-none text-foreground sm:text-[88px]">
                {formatClock(session.seconds)}
              </div>
              <div className="mt-2 truncate font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{session.title}</div>
            </div>

            <LevelMeter getAnalyser={getAnalyser} active={session.phase === 'recording'} className="h-12 sm:h-16" />

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={session.phase === 'paused' ? resumeRecording : pauseRecording}
                disabled={session.phase === 'stopping'}
                className="grid size-12 place-items-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:opacity-40 sm:size-14"
                aria-label={session.phase === 'paused' ? 'Resume' : 'Pause'}
              >
                {session.phase === 'paused' ? <Play className="size-5" /> : <Pause className="size-5" />}
              </button>
              <button
                onClick={stop}
                disabled={session.phase === 'stopping'}
                className="grid size-16 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-40 sm:size-[68px]"
                aria-label="Stop and save"
              >
                <Square className="size-5 fill-current" />
              </button>
            </div>
            <p className="hidden text-center font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase sm:block">
              Stop saves the recording as a new meeting
            </p>

            {session.warning && <Notice tone="warning" icon={<CircleAlert className="size-4" />}>{session.warning}</Notice>}
            {session.error && <Notice tone="error" icon={<CircleAlert className="size-4" />}>{session.error}</Notice>}

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
              <Stat icon={<HardDrive className="size-4" />} label="Saved on device" value={`${session.chunks} chunks`} />
              <Stat
                icon={<AudioLines className="size-4" />}
                label="Uploaded"
                value={sync.online ? `${uploaded} / ${session.chunks}` : 'Offline - later'}
                tone={sync.online ? undefined : 'warn'}
              />
              <Stat
                icon={<Smartphone className="size-4" />}
                label="Screen"
                value={wakeLock === 'on' ? 'Kept awake' : wakeLock === 'unsupported' ? 'Keep it on' : 'May sleep'}
                tone={wakeLock === 'on' ? undefined : 'warn'}
              />
              <Stat icon={<Info className="size-4" />} label="Language" value={language ? languageName(language) : 'Auto-detect'} />
            </div>
          </div>
        )}
      </Card>

      <Card className="panel-ticks flex h-[60vh] min-h-80 flex-col overflow-hidden lg:sticky lg:top-16 lg:h-[calc(100dvh-7rem)]">
        {session.meetingId ? (
          <LivePanel key={session.meetingId} meetingId={session.meetingId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="grid size-12 place-items-center rounded-md border border-border bg-background text-muted-foreground">
              <AudioLines className="size-6" />
            </div>
            <p className="mt-4 font-medium text-foreground">The live transcript will appear here</p>
            <p className="mt-1 max-w-sm text-base text-muted-foreground">
              Speech is transcribed in its original language while you record. After you stop, the whole recording is
              transcribed again for the best accuracy.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              <span className="size-1.5 rounded-[1px] bg-muted-foreground" />
              Awaiting input
              <span className="inline-block h-3 w-0.5 animate-[blink_1.05s_steps(1)_infinite] bg-foreground" />
            </div>
            <TranscriptDemo />
          </div>
        )}
      </Card>
    </div>
  )
}
