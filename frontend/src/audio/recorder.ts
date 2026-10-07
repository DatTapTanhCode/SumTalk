import type { CaptureMode } from '../api/types'

export const TARGET_RATE = 16_000

export class RecorderError extends Error {}

interface RecorderOptions {
  chunkSeconds: number
  /** Called with each finished chunk, in order. stop() waits for the returned promises. */
  onChunk: (pcm: Int16Array, seq: number) => Promise<void>
  onSourceEnded?: (source: 'mic' | 'meeting') => void
  onError?: (error: unknown) => void
}

/** Why recording cannot work in this browser, or null if it can. */
export function recordingUnsupportedReason(): string | null {
  if (!window.isSecureContext) return 'The microphone only works on https:// or http://localhost. Open the app through one of those.'
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot access the microphone.'
  if (typeof AudioWorkletNode === 'undefined') return 'This browser is too old to record audio (no AudioWorklet).'
  return null
}

/** Sharing a tab's / the system's audio only works in desktop Chromium browsers (Chrome, Edge...). */
export function canCaptureMeetingAudio(): boolean {
  const ua = navigator.userAgent
  return Boolean(navigator.mediaDevices?.getDisplayMedia) && /Chrome\//.test(ua) && !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)
}

function describeMediaError(error: unknown, what: string): RecorderError {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
      return new RecorderError(`Permission to use the ${what} was denied. Allow it from the icon in the address bar and try again.`)
    case 'NotFoundError':
      return new RecorderError(`No ${what} was found on this device.`)
    case 'NotReadableError':
      return new RecorderError(`The ${what} is being used by another application.`)
    default:
      return new RecorderError(`Could not start the ${what}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Microphone (+ optionally the meeting's tab/system audio) -> Web Audio mix -> low-pass ->
 * AudioWorklet (16 kHz mono Int16) -> fixed-length chunks.
 */
export class AudioRecorder {
  analyser: AnalyserNode | null = null
  totalSamples = 0
  state: 'idle' | 'recording' | 'paused' | 'stopped' = 'idle'

  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private streams: MediaStream[] = []
  private buffers: Int16Array[] = []
  private buffered = 0
  private seq = 0
  private pending = new Set<Promise<void>>()
  private readonly chunkSamples: number

  constructor(private readonly options: RecorderOptions) {
    this.chunkSamples = Math.round(options.chunkSeconds * TARGET_RATE)
  }

  async start(mode: CaptureMode): Promise<void> {
    // Created before any await so it counts as started by the user's click (Safari/iOS autoplay rules).
    const context = new AudioContext({ latencyHint: 'interactive' })
    this.context = context
    try {
      const mic = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
        .catch((error) => {
          throw describeMediaError(error, 'microphone')
        })
      this.streams.push(mic)

      let meeting: MediaStream | null = null
      if (mode === 'mic+system') {
        meeting = await navigator.mediaDevices
          .getDisplayMedia({
            video: true, // required by browsers; we drop the video track right away
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            systemAudio: 'include',
            selfBrowserSurface: 'exclude',
          } as DisplayMediaStreamOptions)
          .catch((error) => {
            throw error instanceof DOMException && error.name === 'NotAllowedError'
              ? new RecorderError('Sharing the meeting audio was cancelled.')
              : describeMediaError(error, 'screen sharing')
          })
        this.streams.push(meeting)
        meeting.getVideoTracks().forEach((track) => track.stop())
        if (meeting.getAudioTracks().length === 0) {
          throw new RecorderError(
            'No audio was shared. Choose the meeting tab (or Entire screen) and turn on "Share tab audio" / "Share system audio".',
          )
        }
      }

      await context.audioWorklet.addModule('/pcm-worklet.js')
      const mix = context.createGain()
      context.createMediaStreamSource(mic).connect(mix)
      if (meeting) context.createMediaStreamSource(new MediaStream(meeting.getAudioTracks())).connect(mix)

      // Two 2nd-order low-pass filters remove content above 8 kHz before the worklet downsamples.
      const lowpass = [0, 1].map(() => {
        const filter = context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 7200
        return filter
      })
      const node = new AudioWorkletNode(context, 'pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: { targetRate: TARGET_RATE },
      })
      node.port.onmessage = (event: MessageEvent<Int16Array>) => this.receive(event.data)
      mix.connect(lowpass[0]).connect(lowpass[1]).connect(node)

      const silent = context.createGain()
      silent.gain.value = 0
      node.connect(silent).connect(context.destination) // keeps the graph running without playing anything

      this.analyser = context.createAnalyser()
      this.analyser.fftSize = 2048
      mix.connect(this.analyser)

      mic.getAudioTracks()[0]?.addEventListener('ended', () => this.options.onSourceEnded?.('mic'))
      meeting?.getAudioTracks()[0]?.addEventListener('ended', () => this.options.onSourceEnded?.('meeting'))

      if (context.state === 'suspended') await context.resume()
      this.node = node
      this.state = 'recording'
      node.port.postMessage({ recording: true })
    } catch (error) {
      this.release()
      throw error
    }
  }

  pause(): void {
    if (this.state !== 'recording') return
    this.state = 'paused'
    this.node?.port.postMessage({ recording: false })
    this.flush()
  }

  resume(): void {
    if (this.state !== 'paused') return
    this.state = 'recording'
    void this.context?.resume()
    this.node?.port.postMessage({ recording: true })
  }

  /** Stops capture, emits the last partial chunk and waits until every chunk has been handled. */
  async stop(): Promise<{ chunks: number; samples: number }> {
    if (this.state === 'recording' || this.state === 'paused') {
      this.node?.port.postMessage({ recording: false })
      // Let the worklet hand over the audio it is still holding (< 100 ms).
      await new Promise((resolve) => setTimeout(resolve, 150))
      this.state = 'stopped'
      this.flush()
    }
    this.release()
    await Promise.all([...this.pending])
    return { chunks: this.seq, samples: this.totalSamples }
  }

  private receive(pcm: Int16Array): void {
    if (this.state === 'stopped' || this.state === 'idle') return
    this.buffers.push(pcm)
    this.buffered += pcm.length
    this.totalSamples += pcm.length
    if (this.buffered >= this.chunkSamples) this.flush()
  }

  private flush(): void {
    if (this.buffered === 0) return
    const chunk = new Int16Array(this.buffered)
    let offset = 0
    for (const buffer of this.buffers) {
      chunk.set(buffer, offset)
      offset += buffer.length
    }
    this.buffers = []
    this.buffered = 0
    const seq = this.seq++
    const task: Promise<void> = this.options
      .onChunk(chunk, seq)
      .catch((error) => this.options.onError?.(error))
      .finally(() => this.pending.delete(task))
    this.pending.add(task)
  }

  private release(): void {
    this.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    this.streams = []
    if (this.node) this.node.port.onmessage = null
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.analyser = null
  }
}
