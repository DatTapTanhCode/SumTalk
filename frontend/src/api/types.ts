export type MeetingStatus = 'recording' | 'uploading' | 'queued' | 'processing' | 'transcribing' | 'done' | 'failed'
export type CaptureMode = 'mic' | 'mic+system'
export type TranscriptKind = 'live' | 'final'

export interface Meeting {
  id: string
  title: string
  source: 'recording' | 'upload'
  status: MeetingStatus
  capture_mode: CaptureMode | null
  language: string | null
  detected_language: string | null
  language_probability: number | null
  duration_sec: number
  progress: number
  error: string | null
  original_filename: string | null
  size_bytes: number | null
  received_chunks: number
  total_chunks: number | null
  meeting_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  has_audio: boolean
  transcript_kind: TranscriptKind
}

export interface Segment {
  idx: number
  start: number
  end: number
  text: string
  language: string | null
}

export interface Transcript {
  kind: TranscriptKind
  segments: Segment[]
  partial: string | null
}

export interface UploadSession {
  id: string
  meeting_id: string
  part_size: number
  total_parts: number
  received_parts: number[]
  status: 'uploading' | 'completed'
}

export interface ClientConfig {
  sample_rate: number
  chunk_seconds: number
  max_upload_mb: number
  allowed_extensions: string[]
  live_transcription: boolean
  summary_languages: string[]
  translation_languages: string[]
  default_summary_language: string
  ai_mock: boolean
}

export interface Health {
  ok: boolean
  stt: {
    status: 'idle' | 'loading' | 'ready' | 'error'
    model: string | null
    device: string | null
    compute_type: string | null
    error: string | null
  }
}

export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'json'

// ---- Sprint 3: summary (#67) + translation (#60)

export type AIJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface ActionItem {
  task: string
  owner: string | null
  due: string | null
  /** idx of the transcript segments that mention it */
  segment_ids: number[]
}

export interface Minutes {
  overview: string
  key_points: string[]
  decisions: string[]
  action_items: ActionItem[]
  open_questions: string[]
}

export interface Summary {
  status: AIJobStatus
  language: string
  content: Minutes | null
  error: string | null
  model: string | null
  mode: 'empty' | 'single' | 'map_reduce' | null
  calls: number
  input_tokens: number
  output_tokens: number
  latency_sec: number
  cost_usd: number
  updated_at: string
}

export interface TranslationInfo {
  target_lang: string
  status: AIJobStatus
  progress: number
  error: string | null
  updated_at: string
}

export interface TranslatedSegment {
  segment_id: number
  start: number
  end: number
  speaker: string | null
  original: string
  translation: string | null
  skipped: boolean
}

export interface Translation extends TranslationInfo {
  model: string | null
  segments: TranslatedSegment[]
}

export type TranslationExportFormat = 'txt' | 'srt'
export type TranslationExportMode = 'translated' | 'bilingual'
