import { CircleAlert, LinkIcon, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError, NetworkError, api, errorMessage } from '@/api/client'
import type { SharedMeeting } from '@/api/types'
import { Logo } from '@/components/Layout'
import { MinutesView } from '@/components/SummaryPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatClock } from '@/lib/format'
import { languageName } from '@/lib/languages'

function SharedContent({ token }: { token: string }) {
  const [meeting, setMeeting] = useState<SharedMeeting>()
  const [error, setError] = useState('')
  const [gone, setGone] = useState(false)
  const [reload, setReload] = useState(0)
  const loaded = useRef(false)
  const [language, setLanguage] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await api.sharedMeeting(token)
        if (active) {
          loaded.current = true
          setMeeting(result)
          setError('')
          setGone(false)
        }
      } catch (e) {
        if (!active) return
        if (e instanceof ApiError && e.status === 404) {
          // Turned off by its owner, or never existed: hide what was shown before right away.
          loaded.current = false
          setMeeting(undefined)
          setGone(true)
        } else if (!loaded.current) {
          // Nothing on screen yet; a failed refresh of a loaded page keeps what is shown.
          setError(e instanceof NetworkError ? 'Cannot reach SumTalk right now. Check your connection.' : errorMessage(e))
        }
      }
    }
    void load()
    // Revalidate when returning to an open link, including browser back/forward restoration.
    window.addEventListener('focus', load)
    window.addEventListener('pageshow', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
      window.removeEventListener('pageshow', load)
    }
  }, [token, reload])
  const translated = meeting?.translations.find((item) => item.target_lang === language)
  const translatedText = new Map(translated?.segments.map((s) => [s.segment_id, s.translation]))

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <Logo className="size-8" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">SumTalk</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            <LinkIcon className="size-3" /> Read only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8 pb-16">
        <div>
          <div className="eyebrow text-[11px]">Shared with you</div>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-foreground">Shared meeting</h1>
          {meeting && (
            <p className="mt-1 text-base text-muted-foreground">
              {meeting.segments.length
                ? `${meeting.segments.length} transcript lines · ${formatClock(meeting.segments[meeting.segments.length - 1].end)} long`
                : 'The transcript is not ready yet.'}
            </p>
          )}
        </div>

        {gone && (
          <Card className="flex flex-col items-center px-6 py-14 text-center">
            <div className="grid size-11 place-items-center rounded-md border border-border bg-card text-muted-foreground">
              <LinkIcon className="size-5" />
            </div>
            <p role="alert" className="mt-3 text-[17px] font-semibold text-foreground">
              This share link is no longer available
            </p>
            <p className="mt-1 max-w-sm text-base text-muted-foreground">
              The owner turned it off, or the address is incomplete. Ask them for a new link.
            </p>
          </Card>
        )}

        {error && !gone && (
          <Card className="flex flex-col items-center px-6 py-12 text-center">
            <CircleAlert className="size-5 text-live" />
            <p role="alert" className="mt-3 text-base text-foreground">
              {error}
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
              <RotateCw className="size-3.5" /> Try again
            </Button>
          </Card>
        )}

        {!error && !gone && !meeting && (
          <div className="space-y-4" role="status" aria-label="Opening share link">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {meeting && (
          <>
            {meeting.has_audio && (
              <audio
                aria-label="Meeting audio"
                controls
                preload="metadata"
                className="w-full"
                src={`/api/shared/${encodeURIComponent(token)}/audio`}
              />
            )}
            <Card className="space-y-4 p-5">
              <h2 className="text-xl font-semibold">Summary</h2>
              {meeting.summary ? (
                <MinutesView minutes={meeting.summary} segments={meeting.segments} />
              ) : (
                <p className="text-muted-foreground">No summary available yet.</p>
              )}
            </Card>
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Transcript</h2>
                {!!meeting.translations.length && (
                  <label className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
                    Language
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-8 rounded-md border border-input bg-card px-2 font-mono text-[12px] text-foreground normal-case"
                    >
                      <option value="">Original</option>
                      {meeting.translations.map((t) => (
                        <option key={t.target_lang} value={t.target_lang}>
                          {languageName(t.target_lang)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {meeting.segments.length ? (
                <ol className="divide-y divide-border">
                  {meeting.segments.map((s) => (
                    <li key={s.idx} className="flex gap-4 py-2.5">
                      <span className="w-12 shrink-0 pt-0.5 font-mono text-[12px] text-muted-foreground tabular-nums">{formatClock(s.start)}</span>
                      <div className="min-w-0">
                        <p className="text-[16px] leading-[1.6] text-foreground">{s.text}</p>
                        {translatedText.get(s.idx) && (
                          <p lang={language} className="mt-1 text-[15px] leading-[1.6] text-muted-foreground">
                            {translatedText.get(s.idx)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">No transcript available yet.</p>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export function SharedMeetingPage() {
  const { token = '' } = useParams()
  return <SharedContent key={token} token={token} />
}
