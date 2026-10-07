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
