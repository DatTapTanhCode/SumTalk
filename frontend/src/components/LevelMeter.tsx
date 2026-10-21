import { useEffect, useRef } from 'react'

/** Scrolling bar waveform of the microphone level, drawn from an AnalyserNode. */
export function LevelMeter({
  getAnalyser,
  active,
  className = 'h-16',
}: {
  getAnalyser: () => AnalyserNode | null
  active: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levels = useRef<number[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let frame = 0
    let lastPush = 0
    const samples = new Float32Array(2048)

    const draw = (time: number) => {
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio
        canvas.height = height * ratio
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const barWidth = 3
      const gap = 2
      const maxBars = Math.floor(width / (barWidth + gap))
      const analyser = getAnalyser()
      if (time - lastPush > 50) {
        lastPush = time
        let level = 0
        if (analyser && active) {
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          for (const v of samples) sum += v * v
          level = Math.min(1, Math.sqrt(sum / samples.length) * 6)
        }
        levels.current.push(level)
        if (levels.current.length > maxBars) levels.current.splice(0, levels.current.length - maxBars)
      }

      context.clearRect(0, 0, width, height)
      const list = levels.current
      const offset = maxBars - list.length
      for (let i = 0; i < list.length; i++) {
        const barHeight = Math.max(3, list[i] * (height - 4))
        const x = (offset + i) * (barWidth + gap)
        context.fillStyle = active ? (i > list.length - 4 ? '#d71921' : '#0a0a0a') : '#c9c9c4'
        context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [getAnalyser, active])

  return <canvas ref={canvasRef} className={`${className} w-full`} aria-hidden />
}
