import { useEffect, useState } from 'react'

/** Keeps the screen on while `active` (phones stop the microphone when they lock). */
export function useWakeLock(active: boolean): 'on' | 'off' | 'unsupported' {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!active || !supported) return
    let lock: WakeLockSentinel | null = null
    let disposed = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (disposed) void lock.release()
        else {
          setOn(true)
          lock.addEventListener('release', () => setOn(false))
        }
      } catch {
        setOn(false)
      }
    }
    // The lock is dropped whenever the tab is hidden; take it again when the user comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
      setOn(false)
    }
  }, [active, supported])

  if (!supported) return 'unsupported'
  return on ? 'on' : 'off'
}
