import { api } from '../api/client'
import type { ClientConfig, Health } from '../api/types'
import { Store } from './store'

const CONFIG_KEY = 'sumtalk.config'

const DEFAULT_CONFIG: ClientConfig = {
  sample_rate: 16000,
  chunk_seconds: 3,
  max_upload_mb: 1024,
  allowed_extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.webm', '.flac', '.wma', '.amr', '.3gp', '.mp4', '.mov', '.mkv'],
  live_transcription: true,
}

function cachedConfig(): ClientConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

/** Server-defined limits. Cached so the recorder also works when the app starts offline. */
export const configStore = new Store<ClientConfig>(cachedConfig())

/** Is the server reachable, and is the speech model loaded? */
export const healthStore = new Store<{ reachable: boolean | null; stt: Health['stt'] | null }>({
  reachable: null,
  stt: null,
})

async function refreshConfig(): Promise<void> {
  try {
    const config = await api.config()
    configStore.set(config)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // keep the cached copy
  }
}

async function pollHealth(): Promise<void> {
  let delay = 30_000
  try {
    const health = await api.health()
    healthStore.set({ reachable: true, stt: health.stt })
    if (health.stt.status !== 'ready') delay = 3_000
  } catch {
    healthStore.set({ reachable: false })
    delay = 5_000
  }
  setTimeout(pollHealth, delay)
}

export function startServerWatch(): void {
  void refreshConfig()
  void pollHealth()
  window.addEventListener('online', () => void refreshConfig())
}
