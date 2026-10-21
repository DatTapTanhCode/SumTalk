import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { formatClock } from '@/lib/format'

const RATES = [1, 1.25, 1.5, 2]

export function AudioPlayer({
  audioRef,
  src,
  currentTime,
  durationSec,
  playing,
  onTimeUpdate,
  onPlayingChange,
}: {
  audioRef: RefObject<HTMLAudioElement | null>
  src: string
  currentTime: number
  durationSec: number
  playing: boolean
  onTimeUpdate: (seconds: number) => void
  onPlayingChange: (playing: boolean) => void
}) {
  const [rate, setRate] = useState(1)
  const [mediaDuration, setMediaDuration] = useState(0)

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate, audioRef])

  const duration = durationSec > 0 ? durationSec : mediaDuration
  const max = duration > 0 ? duration : 1
  const position = Math.min(currentTime, max)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const skip = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    const end = Number.isFinite(audio.duration) ? audio.duration : duration
    audio.currentTime = Math.max(0, Math.min(end - 0.25, audio.currentTime + delta))
  }

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
  }

  return (
    <Card className="sticky top-12 z-20 flex flex-wrap items-center gap-2 bg-card/95 px-2.5 py-2 backdrop-blur sm:gap-3 sm:px-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
      />
      <Button size="icon" className="rounded-md" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <div className="flex items-center">
        <Button variant="ghost" size="icon-sm" onClick={() => skip(-10)} aria-label="Back 10 seconds">
          <RotateCcw className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => skip(10)} aria-label="Forward 10 seconds">
          <RotateCw className="size-4" />
        </Button>
      </div>
      <select
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        aria-label="Playback speed"
        className="rounded-[3px] border border-input bg-card px-1.5 py-1 font-mono text-[11px] text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none"
      >
        {RATES.map((value) => (
          <option key={value} value={value}>
            {value}×
          </option>
        ))}
      </select>
      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
        <Slider value={[position]} max={max} step={1} onValueChange={([value]) => seek(value)} aria-label="Seek" className="flex-1" />
        <span className="digital shrink-0 text-[14px] text-muted-foreground">
          {formatClock(position)} / {formatClock(duration)}
        </span>
      </div>
    </Card>
  )
}
