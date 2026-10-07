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
import { TranscriptView } from '../components/TranscriptView'
import { Card, Notice, inputClass } from '../components/ui'
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
        'flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'bg-indigo-50/60 ring-2 ring-indigo-500' : 'bg-white ring-slate-200 hover:bg-slate-50',
      )}
    >
      <div className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500')}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
    </button>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2 sm:py-2.5">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</div>
        <div className={cn('truncate text-sm font-medium', tone === 'warn' ? 'text-amber-700' : 'text-slate-800')}>{value}</div>
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
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 font-medium text-slate-900">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
          </span>
          Live transcript
        </div>
        {language && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {languageName(language)}
            {!meeting?.language && ' · detected'}
          </span>
        )}
      </div>
      <div data-scroll className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {offline || notOnServer ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-slate-500">
            <HardDrive className="mb-3 size-8 text-slate-300" />
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
              <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center text-sm text-slate-500">
                <AudioLines className="mb-3 size-8 text-slate-300" />
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
    void startRecording({ title: title.trim() || defaultMeetingTitle(), language, captureMode: mode })
  }

  const stop = async () => {
    const id = await stopRecording()
    setTitle('')
    if (id) navigate(`/meetings/${id}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="h-fit p-5 sm:p-6">
        {!recording ? (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">New recording</h1>
              <p className="mt-1 text-sm text-slate-500">
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
                  <button onClick={clearSessionError} className="text-rose-700/70 hover:text-rose-900" aria-label="Dismiss">
                    <X className="size-4" />
                  </button>
                }
              >
                {session.error}
              </Notice>
            )}

            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium text-slate-700">Title</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultMeetingTitle()} className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="language" className="text-sm font-medium text-slate-700">Spoken language</label>
              <LanguageSelect id="language" value={language} onChange={setLanguage} />
              <p className="text-xs text-slate-500">Auto-detect handles mixed languages. Choose one if detection guesses wrong.</p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Audio source</div>
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
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-rose-600 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              <span className="grid size-6 place-items-center rounded-full bg-white/20">
                <span className="size-2.5 rounded-full bg-white" />
              </span>
              {session.phase === 'starting' ? 'Starting…' : 'Start recording'}
            </button>
            <p className="text-center text-xs text-slate-400">
              <Smartphone className="mr-1 inline size-3.5 -translate-y-px" />
              On a phone, keep this screen open - it stays awake while recording.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                  session.phase === 'recording' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
                )}
              >
                <span className={cn('size-2 rounded-full', session.phase === 'recording' ? 'animate-pulse bg-rose-500' : 'bg-amber-500')} />
                {session.phase === 'recording' ? 'Recording' : session.phase === 'paused' ? 'Paused' : 'Saving…'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                {session.captureMode === 'mic' ? <Mic className="size-3.5" /> : <MonitorSpeaker className="size-3.5" />}
                {session.captureMode === 'mic' ? 'Microphone' : 'Mic + meeting audio'}
              </span>
            </div>

            <div className="text-center">
              <div data-testid="timer" className="font-mono text-5xl font-light tracking-tight text-slate-900 tabular-nums sm:text-6xl">
                {formatClock(session.seconds)}
              </div>
              <div className="mt-1.5 truncate text-sm text-slate-500">{session.title}</div>
            </div>

            <LevelMeter getAnalyser={getAnalyser} active={session.phase === 'recording'} className="h-12 sm:h-16" />

            <div className="flex items-center justify-center gap-5">
              <button
                onClick={session.phase === 'paused' ? resumeRecording : pauseRecording}
                disabled={session.phase === 'stopping'}
                className="grid size-12 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 sm:size-14"
                aria-label={session.phase === 'paused' ? 'Resume' : 'Pause'}
              >
                {session.phase === 'paused' ? <Play className="size-6" /> : <Pause className="size-6" />}
              </button>
              <button
                onClick={stop}
                disabled={session.phase === 'stopping'}
                className="grid size-16 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 sm:size-18"
                aria-label="Stop and save"
              >
                <Square className="size-6 fill-current sm:size-7" />
              </button>
            </div>
            <p className="-mt-2 hidden text-center text-xs text-slate-400 sm:block">Stop saves the recording as a new meeting</p>

            {session.warning && <Notice tone="warning" icon={<CircleAlert className="size-4" />}>{session.warning}</Notice>}
            {session.error && <Notice tone="error" icon={<CircleAlert className="size-4" />}>{session.error}</Notice>}

            <div className="grid grid-cols-2 gap-2">
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

      <Card className="flex h-[60vh] min-h-80 flex-col overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100dvh-7.5rem)]">
        {session.meetingId ? (
          <LivePanel key={session.meetingId} meetingId={session.meetingId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">
              <AudioLines className="size-7" />
            </div>
            <p className="mt-4 font-medium text-slate-700">The live transcript will appear here</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Speech is transcribed in its original language while you record. After you stop, the whole recording is
              transcribed again for the best accuracy.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
