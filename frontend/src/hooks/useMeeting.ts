import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../api/client'
import type { Meeting, MeetingStatus, Transcript } from '../api/types'

const ACTIVE: MeetingStatus[] = ['recording', 'uploading', 'queued', 'processing', 'transcribing']
const EMPTY: Transcript = { kind: 'final', segments: [], partial: null }

export const isActive = (status: MeetingStatus) => ACTIVE.includes(status)

/**
 * Meeting + transcript, polled while the server is still working on it.
 * Only new segments are fetched each time; when the live draft is replaced by the
 * final transcript (kind changes) the whole list is fetched again.
 */
export function useMeeting(id: string) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [transcript, setTranscript] = useState<Transcript>(EMPTY)
  const [notOnServer, setNotOnServer] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pollKey, setPollKey] = useState(0)
  const transcriptRef = useRef(transcript)
  const inFlight = useRef(false)

  const refresh = useCallback(async (): Promise<Meeting | null> => {
    if (inFlight.current) return null
    inFlight.current = true
    try {
      const next = await api.getMeeting(id)
      setMeeting(next)
      setNotOnServer(false)
      const current = transcriptRef.current
      const last = current.segments.at(-1)?.idx ?? -1
      const response = await api.transcript(id, current.kind, last)
      let merged: Transcript = response
      if (response.kind === current.kind) {
        const fresh = response.segments.filter((s) => s.idx > last)
        merged = { ...response, segments: fresh.length ? [...current.segments, ...fresh] : current.segments }
      }
      transcriptRef.current = merged
      setTranscript(merged)
      return next
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setNotOnServer(true)
      return null
    } finally {
      inFlight.current = false
      setLoaded(true)
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const loop = async () => {
      const current = await refresh()
      if (cancelled) return
      const delay = current === null ? 3000 : isActive(current.status) ? 1500 : 0
      if (delay) timer = window.setTimeout(loop, delay)
    }
    void loop()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [refresh, pollKey])

  /** After an action that restarts processing (e.g. re-transcribe). */
  const restart = useCallback((updated?: Meeting) => {
    if (updated) setMeeting(updated)
    transcriptRef.current = EMPTY
    setTranscript(EMPTY)
    setPollKey((k) => k + 1)
  }, [])

  return { meeting, setMeeting, transcript, notOnServer, loaded, refresh, restart }
}
