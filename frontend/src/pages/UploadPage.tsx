import { CircleAlert, CloudUpload, FileAudio, LoaderCircle, Upload, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage } from '../api/client'
import { LanguageSelect } from '../components/LanguageSelect'
import { Button, Card, Notice, ProgressBar, inputClass } from '../components/ui'
import { cn, formatBytes, formatDuration } from '../lib/format'
import { configStore } from '../lib/server'
import { useStore } from '../lib/store'
import { uploadAudioFile, validateAudioFile, type UploadProgress } from '../upload/uploader'

/** Reads the duration in the browser when it can decode the format (purely informative). */
function useMediaDuration(file: File | null): number | null {
  const [duration, setDuration] = useState<number | null>(null)
  useEffect(() => {
    setDuration(null)
    if (!file) return
    const url = URL.createObjectURL(file)
    const media = document.createElement('audio')
    media.preload = 'metadata'
    media.onloadedmetadata = () => setDuration(Number.isFinite(media.duration) ? media.duration : null)
    media.src = url
    return () => {
      media.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file])
  return duration
}

export function UploadPage() {
  const config = useStore(configStore)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<string | null>(() => localStorage.getItem('sumtalk.language'))
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const duration = useMediaDuration(file)

  const validation = file ? validateAudioFile(file, config) : null
  const uploading = progress !== null

  const choose = (picked: File | undefined) => {
    if (!picked || uploading) return
    setFile(picked)
    setTitle(picked.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  const upload = async () => {
    if (!file || validation) return
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setProgress({ phase: 'starting', loaded: 0, total: file.size, partsDone: 0, totalParts: 0, bytesPerSecond: 0, waitingForNetwork: false })
    try {
      const meeting = await uploadAudioFile(file, {
        title: title.trim() || file.name,
        language,
        signal: controller.signal,
        onProgress: setProgress,
      })
      navigate(`/meetings/${meeting.id}`)
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e))
      setProgress(null)
    }
  }

  const cancel = () => abortRef.current?.abort()
  const accept = config.allowed_extensions.join(',') + ',audio/*'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload audio</h1>
        <p className="mt-1 text-sm text-slate-500">
          An existing recording becomes a meeting. Large files are sent in parts and resume after a network drop; the server
          converts every format to 16 kHz mono WAV before transcribing.
        </p>
      </div>

      {!file ? (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors',
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50',
          )}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <CloudUpload className="size-7" />
          </div>
          <p className="mt-4 font-medium text-slate-800">Drop an audio file here, or click to choose</p>
          <p className="mt-1 text-xs text-slate-500">
            {config.allowed_extensions.map((e) => e.slice(1).toUpperCase()).join(' · ')} · up to {config.max_upload_mb} MB
          </p>
          <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </label>
      ) : (
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={cn('grid size-12 shrink-0 place-items-center rounded-xl', validation ? 'bg-red-50 text-red-500' : 'bg-sky-50 text-sky-600')}>
              <FileAudio className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900">{file.name}</div>
              <div className="mt-0.5 text-sm text-slate-500">
                {formatBytes(file.size)}
                {file.type && ` · ${file.type}`}
                {duration !== null && ` · ${formatDuration(duration)}`}
              </div>
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Remove file">
                <X className="size-5" />
              </button>
            )}
          </div>

          {validation && <Notice tone="error" icon={<CircleAlert className="size-4" />} title="This file can't be used">{validation}</Notice>}
          {error && <Notice tone="error" icon={<CircleAlert className="size-4" />} title="Upload failed">{error}</Notice>}

          {!validation && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="upload-title" className="text-sm font-medium text-slate-700">Meeting title</label>
                  <input id="upload-title" value={title} disabled={uploading} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="upload-language" className="text-sm font-medium text-slate-700">Spoken language</label>
                  <LanguageSelect id="upload-language" value={language} onChange={setLanguage} disabled={uploading} />
                </div>
              </div>

              {progress ? (
                <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      {progress.waitingForNetwork ? (
                        <WifiOff className="size-4 text-amber-600" />
                      ) : (
                        <LoaderCircle className="size-4 animate-spin text-indigo-500" />
                      )}
                      {progress.phase === 'starting'
                        ? 'Starting upload…'
                        : progress.phase === 'finishing'
                          ? 'Creating the meeting…'
                          : progress.waitingForNetwork
                            ? 'Waiting for the network…'
                            : 'Uploading…'}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">{Math.round((progress.loaded / progress.total) * 100)}%</span>
                  </div>
                  <ProgressBar value={progress.loaded / progress.total} indeterminate={progress.phase !== 'uploading'} />
                  <div className="flex justify-between text-xs text-slate-500 tabular-nums">
                    <span>
                      {formatBytes(progress.loaded)} of {formatBytes(progress.total)}
                      {progress.bytesPerSecond > 0 && ` · ${formatBytes(progress.bytesPerSecond)}/s`}
                    </span>
                    {progress.totalParts > 0 && <span>Part {progress.partsDone} / {progress.totalParts}</span>}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                {uploading ? (
                  <Button variant="secondary" onClick={cancel} disabled={progress?.phase === 'finishing'}>
                    Cancel
                  </Button>
                ) : (
                  <Button onClick={upload}>
                    <Upload className="size-4" /> Upload &amp; transcribe
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
