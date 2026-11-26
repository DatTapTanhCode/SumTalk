import type {
  AuthState,
  ClientConfig,
  ExportFormat,
  Health,
  Meeting,
  MeetingFilters,
  ShareLink,
  SharedMeeting,
  Summary,
  Transcript,
  TranscriptKind,
  Translation,
  TranslationExportFormat,
  TranslationExportMode,
  TranslationInfo,
  UploadSession,
} from './types'

/** Fired on window when an API call answers 401 (sign-in required). */
export const SIGNED_OUT_EVENT = 'sumtalk:signed-out'

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message)
  }
}

/** The request never reached the server (offline, server down). Safe to retry later. */
export class NetworkError extends Error {
  constructor() {
    super('Cannot reach the server')
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function parseError(status: number, body: string): Promise<ApiError> {
  let detail: unknown
  try {
    detail = JSON.parse(body).detail
  } catch {
    detail = undefined
  }
  const message =
    typeof detail === 'string'
      ? detail
      : (detail as { message?: string } | undefined)?.message ?? `Request failed (HTTP ${status})`
  return new ApiError(status, message, detail)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    // A hung request must not block the sync queue forever.
    response = await fetch(path, { signal: AbortSignal.timeout?.(30_000), ...init })
  } catch {
    throw new NetworkError()
  }
  if (!response.ok) {
    // The session ran out or was signed out elsewhere: the app goes back to the sign-in page.
    if (response.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    throw await parseError(response.status, await response.text())
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  authSession: () => request<AuthState>('/api/auth/session', { signal: AbortSignal.timeout?.(8_000) }),
  login: (username: string, password: string) => request<AuthState>('/api/auth/login', json('POST', { username, password })),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  health: () => request<Health>('/api/health'),
  config: () => request<ClientConfig>('/api/config'),

  listMeetings: (filters: MeetingFilters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    const query = params.toString()
    return request<Meeting[]>(query ? `/api/meetings?${query}` : '/api/meetings')
  },
  listTags: () => request<string[]>('/api/meetings/tags'),
  getMeeting: (id: string) => request<Meeting>(`/api/meetings/${id}`),
  renameMeeting: (id: string, title: string) => request<Meeting>(`/api/meetings/${id}`, json('PATCH', { title })),
  addTag: (id: string, name: string) => request<Meeting>(`/api/meetings/${id}/tags`, json('POST', { name })),
  removeTag: (id: string, name: string) =>
    request<Meeting>(`/api/meetings/${id}/tags/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getShare: (id: string) => request<ShareLink | null>(`/api/meetings/${id}/share`),
  setShare: (id: string, include_audio: boolean) =>
    request<ShareLink>(`/api/meetings/${id}/share`, json('PUT', { include_audio })),
  revokeShare: (id: string) => request<void>(`/api/meetings/${id}/share`, { method: 'DELETE' }),
  sharedMeeting: (token: string) => request<SharedMeeting>(`/api/shared/${encodeURIComponent(token)}`),
  deleteMeeting: (id: string) => request<void>(`/api/meetings/${id}`, { method: 'DELETE' }),

  createRecording: (
    id: string,
    body: { title: string; language: string | null; capture_mode: string; started_at: string; meeting_at: string },
  ) => request<Meeting>(`/api/meetings/${id}`, json('PUT', body)),
  uploadChunk: (id: string, seq: number, pcm: ArrayBuffer) =>
    request<{ seq: number; received_chunks: number }>(`/api/meetings/${id}/chunks/${seq}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Sample-Rate': '16000' },
      body: pcm,
    }),
  finalize: (id: string, totalChunks?: number) =>
    request<Meeting>(`/api/meetings/${id}/finalize`, json('POST', { total_chunks: totalChunks ?? null })),

  transcript: (id: string, kind?: TranscriptKind, after = -1) =>
    request<Transcript>(`/api/meetings/${id}/transcript?${new URLSearchParams({ kind: kind ?? '', after: String(after) })}`),
  retranscribe: (id: string, language: string | null) =>
    request<Meeting>(`/api/meetings/${id}/retranscribe`, json('POST', { language })),

  createUpload: (body: { filename: string; meeting_at: string; size_bytes: number; mime_type: string | null; title: string; language: string | null }) =>
    request<UploadSession>('/api/uploads', json('POST', body)),
  completeUpload: (id: string) => request<Meeting>(`/api/uploads/${id}/complete`, { method: 'POST' }),
  cancelUpload: (id: string) => request<void>(`/api/uploads/${id}`, { method: 'DELETE' }),
  uploadPartUrl: (id: string, n: number) => `/api/uploads/${id}/parts/${n}`,

  audioUrl: (id: string, download = false) => `/api/meetings/${id}/audio${download ? '?download=true' : ''}`,
  exportUrl: (id: string, format: ExportFormat) => `/api/meetings/${id}/export?format=${format}`,

  // Summary (#71). getSummary throws ApiError 404 while the meeting has no summary.
  getSummary: (id: string) => request<Summary>(`/api/meetings/${id}/summary`),
  regenerateSummary: (id: string, language?: string) =>
    request<Summary>(`/api/meetings/${id}/summary/regenerate`, json('POST', language ? { language } : {})),

  // Translation (#64, #65). createTranslation returns the saved one when it already exists (no re-translation).
  listTranslations: (id: string) => request<TranslationInfo[]>(`/api/meetings/${id}/translations`),
  getTranslation: (id: string, lang: string) => request<Translation>(`/api/meetings/${id}/translations/${lang}`),
  createTranslation: (id: string, targetLang: string) =>
    request<Translation>(`/api/meetings/${id}/translations`, json('POST', { target_lang: targetLang })),
  retryTranslation: (id: string, lang: string) =>
    request<Translation>(`/api/meetings/${id}/translations/${lang}/retry`, { method: 'POST' }),
  translationExportUrl: (id: string, lang: string, format: TranslationExportFormat, mode: TranslationExportMode = 'translated') =>
    `/api/meetings/${id}/translations/${lang}/export?${new URLSearchParams({ format, mode })}`,
}
