import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CaptureMode } from '../api/types'

/** A recording made on this device that is not fully on the server yet. */
export interface LocalRecording {
  id: string
  title: string
  language: string | null
  captureMode: CaptureMode
  startedAt: string
  state: 'recording' | 'stopped'
  chunkCount: number // chunks produced so far (next seq)
  totalSamples: number
  createdOnServer: boolean
  error: string | null
}

/** 16 kHz mono 16-bit PCM, `chunk_seconds` long (the last one may be shorter). */
export interface LocalChunk {
  meetingId: string
  seq: number
  data: ArrayBuffer
}

interface Schema extends DBSchema {
  recordings: { key: string; value: LocalRecording }
  chunks: { key: [string, number]; value: LocalChunk }
}

let database: Promise<IDBPDatabase<Schema>> | null = null

function db(): Promise<IDBPDatabase<Schema>> {
  database ??= openDB<Schema>('sumtalk', 1, {
    upgrade(d) {
      d.createObjectStore('recordings', { keyPath: 'id' })
      d.createObjectStore('chunks', { keyPath: ['meetingId', 'seq'] })
    },
  })
  return database
}

const chunkRange = (meetingId: string) => IDBKeyRange.bound([meetingId, 0], [meetingId, Number.MAX_SAFE_INTEGER])

export const localStore = {
  async putRecording(recording: LocalRecording): Promise<void> {
    await (await db()).put('recordings', recording)
  },

  async getRecording(id: string): Promise<LocalRecording | undefined> {
    return (await db()).get('recordings', id)
  },

  async allRecordings(): Promise<LocalRecording[]> {
    const all = await (await db()).getAll('recordings')
    return all.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  },

  /** Read-modify-write in one transaction, so the recorder and the sync engine never overwrite each other. */
  async patchRecording(id: string, patch: Partial<LocalRecording>): Promise<LocalRecording | undefined> {
    const tx = (await db()).transaction('recordings', 'readwrite')
    const current = await tx.store.get(id)
    if (current) await tx.store.put({ ...current, ...patch })
    await tx.done
    return current && { ...current, ...patch }
  },

  async deleteRecording(id: string): Promise<void> {
    const tx = (await db()).transaction(['recordings', 'chunks'], 'readwrite')
    await tx.objectStore('recordings').delete(id)
    await tx.objectStore('chunks').delete(chunkRange(id))
    await tx.done
  },

  async addChunk(chunk: LocalChunk): Promise<void> {
    await (await db()).put('chunks', chunk)
  },

  async chunkSeqs(meetingId: string): Promise<number[]> {
    const keys = await (await db()).getAllKeys('chunks', chunkRange(meetingId))
    return keys.map(([, seq]) => seq)
  },

  async getChunk(meetingId: string, seq: number): Promise<LocalChunk | undefined> {
    return (await db()).get('chunks', [meetingId, seq])
  },

  async deleteChunk(meetingId: string, seq: number): Promise<void> {
    await (await db()).delete('chunks', [meetingId, seq])
  },

  async pendingByMeeting(): Promise<Record<string, number>> {
    const keys = await (await db()).getAllKeys('chunks')
    const counts: Record<string, number> = {}
    for (const [meetingId] of keys) counts[meetingId] = (counts[meetingId] ?? 0) + 1
    return counts
  },
}
