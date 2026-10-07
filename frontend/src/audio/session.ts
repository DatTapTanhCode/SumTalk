import type { CaptureMode } from '../api/types'
import { newId } from '../lib/id'
import { configStore } from '../lib/server'
import { Store } from '../lib/store'
import { localStore } from '../offline/db'
import { kickSync, recordingLockName } from '../offline/sync'
import { AudioRecorder, RecorderError, TARGET_RATE } from './recorder'

/**
 * The one recording in progress. Lives outside React so navigating between pages
 * doesn't stop it (a "REC" pill in the header links back to it).
 */
export interface SessionState {
  phase: 'idle' | 'starting' | 'recording' | 'paused' | 'stopping'
  meetingId: string | null
  title: string
  captureMode: CaptureMode
  seconds: number
  chunks: number
  error: string | null
  warning: string | null
}

export const sessionStore = new Store<SessionState>({
  phase: 'idle',
  meetingId: null,
  title: '',
  captureMode: 'mic',
  seconds: 0,
  chunks: 0,
  error: null,
  warning: null,
})

let recorder: AudioRecorder | null = null
let releaseLock: (() => void) | null = null
let ticker: number | undefined

export const getAnalyser = (): AnalyserNode | null => recorder?.analyser ?? null

export async function startRecording(options: { title: string; language: string | null; captureMode: CaptureMode }) {
  if (sessionStore.get().phase !== 'idle') return
  sessionStore.set({ phase: 'starting', error: null, warning: null })

  const id = newId()
  let saved: Promise<void> = Promise.resolve()
  const instance: AudioRecorder = new AudioRecorder({
    chunkSeconds: configStore.get().chunk_seconds,
    onChunk: async (pcm, seq) => {
      await saved
      await localStore.addChunk({ meetingId: id, seq, data: pcm.buffer as ArrayBuffer })
      await localStore.patchRecording(id, { chunkCount: seq + 1, totalSamples: instance.totalSamples })
      sessionStore.set({ chunks: seq + 1 })
      kickSync()
    },
    onSourceEnded: (source) => {
      if (source === 'meeting') {
        sessionStore.set({ warning: 'Meeting audio sharing stopped. Still recording the microphone.' })
      } else {
        sessionStore.set({ warning: 'The microphone was disconnected, so the recording was stopped.' })
        void stopRecording()
      }
    },
    onError: (error) =>
      sessionStore.set({ error: `Could not save audio on this device: ${error instanceof Error ? error.message : error}` }),
  })

  try {
    const start = instance.start(options.captureMode) // first, to keep the click's user activation
    saved = localStore.putRecording({
      id,
      title: options.title,
      language: options.language,
      captureMode: options.captureMode,
      startedAt: new Date().toISOString(),
      state: 'recording',
      chunkCount: 0,
      totalSamples: 0,
      createdOnServer: false,
      error: null,
    })
    await Promise.all([start, saved])
  } catch (error) {
    await instance.stop().catch(() => undefined)
    await saved.catch(() => undefined) // don't let the insert land after the delete
    await localStore.deleteRecording(id).catch(() => undefined)
    sessionStore.set({
      phase: 'idle',
      error: error instanceof RecorderError ? error.message : `Could not start recording: ${error instanceof Error ? error.message : error}`,
    })
    return
  }

  recorder = instance
  navigator.locks?.request(recordingLockName(id), () => new Promise<void>((resolve) => (releaseLock = resolve)))
  void navigator.storage?.persist?.() // ask the browser not to evict offline audio
  window.addEventListener('beforeunload', warnBeforeLeaving)
  ticker = window.setInterval(() => sessionStore.set({ seconds: instance.totalSamples / TARGET_RATE }), 250)
  sessionStore.set({
    phase: 'recording',
    meetingId: id,
    title: options.title,
    captureMode: options.captureMode,
    seconds: 0,
    chunks: 0,
  })
  kickSync() // creates the meeting on the server right away when online
}

export function pauseRecording(): void {
  if (!recorder || sessionStore.get().phase !== 'recording') return
  recorder.pause()
  sessionStore.set({ phase: 'paused' })
}

export function resumeRecording(): void {
  if (!recorder || sessionStore.get().phase !== 'paused') return
  recorder.resume()
  sessionStore.set({ phase: 'recording' })
}

/** Returns the meeting id. The audio is safe on the device; the sync engine uploads and finalizes it. */
export async function stopRecording(): Promise<string | null> {
  const { phase, meetingId } = sessionStore.get()
  if (!recorder || !meetingId || (phase !== 'recording' && phase !== 'paused')) return null
  sessionStore.set({ phase: 'stopping' })
  const { chunks, samples } = await recorder.stop()
  await localStore.patchRecording(meetingId, { state: 'stopped', chunkCount: chunks, totalSamples: samples })
  recorder = null
  releaseLock?.()
  releaseLock = null
  window.clearInterval(ticker)
  window.removeEventListener('beforeunload', warnBeforeLeaving)
  sessionStore.set({ phase: 'idle', meetingId: null, seconds: 0, chunks: 0, warning: null })
  kickSync()
  return meetingId
}

export function clearSessionError(): void {
  sessionStore.set({ error: null })
}

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
  event.returnValue = '' // audio recorded so far is kept, but recording would stop
}
