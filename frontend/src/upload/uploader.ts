import { ApiError, NetworkError, api, parseError } from '../api/client'
import type { ClientConfig, Meeting } from '../api/types'

export interface UploadProgress {
  phase: 'starting' | 'uploading' | 'finishing'
  loaded: number
  total: number
  partsDone: number
  totalParts: number
  bytesPerSecond: number
  waitingForNetwork: boolean
}

/** File type & size checks before anything is sent (the server checks again). */
export function validateAudioFile(file: File, config: ClientConfig): string | null {
  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!config.allowed_extensions.includes(extension)) {
    const allowed = config.allowed_extensions.map((e) => e.slice(1).toUpperCase()).join(', ')
    return `"${extension || 'no extension'}" files are not supported. Use one of: ${allowed}.`
  }
  if (file.type && !/^(audio|video)\//.test(file.type) && file.type !== 'application/octet-stream') {
    return `This file is "${file.type}", not audio or video.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > config.max_upload_mb * 1024 * 1024) return `The file is larger than the ${config.max_upload_mb} MB limit.`
  return null
}

const PARALLEL_PARTS = 3
const MAX_ATTEMPTS = 8

/**
 * Sends the file in parts (part size decided by the server), 3 at a time.
 * A failed part is retried with backoff, waiting for the network if the device went offline.
 */
export async function uploadAudioFile(
  file: File,
  options: { title: string; language: string | null; signal: AbortSignal; onProgress: (p: UploadProgress) => void },
): Promise<Meeting> {
  const { signal, onProgress } = options
  const session = await api.createUpload({
    filename: file.name,
    size_bytes: file.size,
    mime_type: file.type || null,
    title: options.title,
    language: options.language,
  })

  const partBytes = (n: number) => Math.min(session.part_size, file.size - n * session.part_size)
  const done = new Set(session.received_parts)
  const inFlight = new Map<number, number>()
  const queue = Array.from({ length: session.total_parts }, (_, n) => n).filter((n) => !done.has(n))
  const startedAt = performance.now()
  const alreadyThere = [...done].reduce((sum, n) => sum + partBytes(n), 0)
  let waitingForNetwork = false

  const report = (phase: UploadProgress['phase'] = 'uploading') => {
    const completed = [...done].reduce((sum, n) => sum + partBytes(n), 0)
    const loaded = completed + [...inFlight.values()].reduce((a, b) => a + b, 0)
    const seconds = (performance.now() - startedAt) / 1000
    onProgress({
      phase,
      loaded,
      total: file.size,
      partsDone: done.size,
      totalParts: session.total_parts,
      bytesPerSecond: seconds > 0.5 ? (loaded - alreadyThere) / seconds : 0,
      waitingForNetwork,
    })
  }

  const sendPart = async (n: number) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const start = n * session.part_size
        await putBlob(api.uploadPartUrl(session.id, n), file.slice(start, start + partBytes(n)), signal, (loaded) => {
          inFlight.set(n, loaded)
          report()
        })
        inFlight.delete(n)
        done.add(n)
        waitingForNetwork = false
        report()
        return
      } catch (error) {
        inFlight.delete(n)
        if (signal.aborted) throw error
        const retryable = error instanceof NetworkError || (error instanceof ApiError && error.status >= 500)
        if (!retryable || attempt >= MAX_ATTEMPTS) throw error
        waitingForNetwork = !navigator.onLine
        report()
        await waitForNetwork(signal)
        await sleep(Math.min(15_000, 500 * 2 ** attempt), signal)
      }
    }
  }

  try {
    report()
    const worker = async () => {
      for (let n = queue.shift(); n !== undefined; n = queue.shift()) await sendPart(n)
    }
    await Promise.all(Array.from({ length: PARALLEL_PARTS }, worker))
    report('finishing')
    return await api.completeUpload(session.id)
  } catch (error) {
    if (signal.aborted) void api.cancelUpload(session.id).catch(() => undefined)
    throw error
  }
}

function putBlob(url: string, blob: Blob, signal: AbortSignal, onProgress: (loaded: number) => void): Promise<void> {
  // XMLHttpRequest because fetch() cannot report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(await parseError(xhr.status, xhr.responseText))
    }
    xhr.onerror = () => reject(new NetworkError())
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    const abort = () => xhr.abort()
    signal.addEventListener('abort', abort, { once: true })
    xhr.onloadend = () => signal.removeEventListener('abort', abort)
    xhr.send(blob)
  })
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Upload cancelled', 'AbortError'))
      },
      { once: true },
    )
  })
}

function waitForNetwork(signal: AbortSignal): Promise<void> {
  if (navigator.onLine) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const online = () => {
      signal.removeEventListener('abort', aborted)
      resolve()
    }
    const aborted = () => {
      window.removeEventListener('online', online)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }
    window.addEventListener('online', online, { once: true })
    signal.addEventListener('abort', aborted, { once: true })
  })
}
