import { ApiError, NetworkError, api, errorMessage } from '../api/client'
import { Store } from '../lib/store'
import { localStore, type LocalRecording } from './db'

/**
 * Offline-first upload of recordings.
 * The recorder only writes chunks to IndexedDB; this engine pushes them to the server in order,
 * deletes each one once acknowledged, and finalizes the meeting after the last chunk.
 * It runs whenever a chunk is saved, the browser comes back online, the tab becomes visible,
 * and every 15 s - so a recording made offline uploads by itself later.
 */

export interface SyncState {
  online: boolean
  syncing: boolean
  recordings: LocalRecording[] // recordings on this device not yet finalized on the server
  pending: Record<string, number> // chunks waiting to upload, per meeting
  lastError: string | null
}

export const syncStore = new Store<SyncState>({
  online: navigator.onLine,
  syncing: false,
  recordings: [],
  pending: {},
  lastError: null,
})

let running = false
let rerun = false
let backoff = 0
let retryTimer: number | undefined

export function kickSync(): void {
  if (running) {
    rerun = true
    return
  }
  void runSync()
}

async function runSync(): Promise<void> {
  running = true
  window.clearTimeout(retryTimer)
  try {
    do {
      rerun = false
      await withLock('sumtalk-sync', syncAll) // one tab at a time
    } while (rerun)
    backoff = 0
    syncStore.set({ lastError: null })
  } catch (error) {
    backoff = Math.min(30_000, Math.max(2_000, backoff * 2))
    syncStore.set({ lastError: error instanceof NetworkError ? null : errorMessage(error) })
    retryTimer = window.setTimeout(kickSync, backoff)
  } finally {
    running = false
    syncStore.set({ syncing: false })
    await refreshLocalState()
  }
}

async function syncAll(): Promise<void> {
  const recordings = await localStore.allRecordings()
  if (recordings.length === 0 || !navigator.onLine) return
  syncStore.set({ syncing: true })
  for (const recording of recordings) {
    if (!recording.error) await syncRecording(recording)
  }
}

async function syncRecording(recording: LocalRecording): Promise<void> {
  const { id } = recording
  try {
    if (!recording.createdOnServer) {
      await api.createRecording(id, {
        title: recording.title,
        language: recording.language,
        capture_mode: recording.captureMode,
        started_at: recording.startedAt,
        meeting_at: recording.meetingAt ?? recording.startedAt,
      })
      await localStore.patchRecording(id, { createdOnServer: true })
    }
    for (const seq of await localStore.chunkSeqs(id)) {
      const chunk = await localStore.getChunk(id, seq)
      if (!chunk) continue
      await api.uploadChunk(id, seq, chunk.data)
      await localStore.deleteChunk(id, seq)
      await refreshLocalState()
    }
    const latest = await localStore.getRecording(id)
    if (latest?.state === 'stopped' && (await localStore.chunkSeqs(id)).length === 0) {
      try {
        await api.finalize(id, latest.chunkCount)
      } catch (error) {
        // 409: the server is missing chunks we no longer have - finish with what it received.
        if (!(error instanceof ApiError && error.status === 409)) throw error
        await api.finalize(id)
      }
      await localStore.deleteRecording(id)
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await localStore.patchRecording(id, { createdOnServer: false }) // server lost it: create again
    } else if (error instanceof ApiError && error.status < 500) {
      await localStore.patchRecording(id, { error: error.message }) // needs a human; don't block others
      return
    }
    throw error // offline or server error: retry with backoff
  }
}

async function refreshLocalState(): Promise<void> {
  try {
    const [recordings, pending] = await Promise.all([localStore.allRecordings(), localStore.pendingByMeeting()])
    syncStore.set({ recordings, pending })
  } catch {
    // IndexedDB unavailable (very old browser / blocked storage)
  }
}

async function withLock(name: string, fn: () => Promise<void>): Promise<void> {
  if (navigator.locks) await navigator.locks.request(name, fn)
  else await fn()
}

/** A recording tab holds this lock, so other tabs know it is still alive. */
export const recordingLockName = (meetingId: string) => `sumtalk-recording-${meetingId}`

export async function retryRecording(id: string): Promise<void> {
  await localStore.patchRecording(id, { error: null })
  kickSync()
}

export async function discardRecording(id: string): Promise<void> {
  await localStore.deleteRecording(id)
  await refreshLocalState()
}

/** Recordings left in "recording" state by a closed/crashed tab are stopped so they get uploaded. */
async function recoverInterruptedRecordings(): Promise<void> {
  const held = new Set((await navigator.locks?.query())?.held?.map((lock) => lock.name) ?? [])
  for (const recording of await localStore.allRecordings()) {
    if (recording.state === 'recording' && !held.has(recordingLockName(recording.id))) {
      await localStore.patchRecording(recording.id, { state: 'stopped' })
    }
  }
}

export function startSync(): void {
  window.addEventListener('online', () => {
    syncStore.set({ online: true })
    kickSync()
  })
  window.addEventListener('offline', () => syncStore.set({ online: false }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kickSync()
  })
  window.setInterval(kickSync, 15_000)
  void recoverInterruptedRecordings()
    .catch(() => undefined)
    .finally(kickSync)
}
