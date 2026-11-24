import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, errorMessage } from '@/api/client'
import type { SharedMeeting } from '@/api/types'
import { MinutesView } from '@/components/SummaryPanel'
import { Card } from '@/components/ui/card'
import { formatClock } from '@/lib/format'
import { languageName } from '@/lib/languages'

function SharedContent({ token }: { token: string }) {
  const [meeting, setMeeting] = useState<SharedMeeting>()
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await api.sharedMeeting(token)
        if (active) { setMeeting(result); setError('') }
      } catch (e) {
        if (active) { setMeeting(undefined); setError(errorMessage(e)) }
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
  }, [token])
  const translated = meeting?.translations.find((item) => item.target_lang === language)
  const translatedText = new Map(translated?.segments.map((s) => [s.segment_id, s.translation]))

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-10">
      <header>
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">SumTalk · Read only</p>
        <h1 className="mt-2 text-3xl font-bold">Shared meeting</h1>
      </header>
      {error && <p role="alert">{error}</p>}
      {!error && !meeting && <p role="status">Opening share link…</p>}
      {meeting && <>
        {meeting.has_audio && <audio aria-label="Meeting audio" controls preload="metadata" className="w-full"
          src={`/api/shared/${encodeURIComponent(token)}/audio`} />}
        <Card className="space-y-4 p-5">
          <h2 className="text-xl font-semibold">Summary</h2>
          {meeting.summary ? <MinutesView minutes={meeting.summary} segments={meeting.segments} /> : <p>No summary available yet.</p>}
        </Card>
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Transcript</h2>
            {!!meeting.translations.length && <label className="flex items-center gap-2 text-sm">Language
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border bg-card p-1">
                <option value="">Original</option>
                {meeting.translations.map((t) => <option key={t.target_lang} value={t.target_lang}>{languageName(t.target_lang)}</option>)}
              </select>
            </label>}
          </div>
          {meeting.segments.length ? <ol className="divide-y">
            {meeting.segments.map((s) => <li key={s.idx} className="flex gap-4 py-2">
              <span className="font-mono text-sm text-muted-foreground">{formatClock(s.start)}</span>
              <div><p>{s.text}</p>{translatedText.get(s.idx) && <p lang={language} className="mt-1 text-muted-foreground">{translatedText.get(s.idx)}</p>}</div>
            </li>)}
          </ol> : <p>No transcript available yet.</p>}
        </Card>
      </>}
    </main>
  )
}

export function SharedMeetingPage() {
  const { token = '' } = useParams()
  return <SharedContent key={token} token={token} />
}
