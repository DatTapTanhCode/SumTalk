import { Check, ChevronDown, CircleAlert, Copy, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, errorMessage } from '../api/client'
import type { Meeting, Minutes, Segment, Summary } from '../api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Notice } from './primitives'
import { formatClock, formatDateTime } from '../lib/format'
import { languageName } from '../lib/languages'
import { configStore } from '../lib/server'
import { useStore } from '../lib/store'
import { copyText } from '../lib/clipboard'

const POLL_MS = 3000
const isRunning = (s: Summary | null) => s?.status === 'pending' || s?.status === 'running'

/** Summary of the meeting (#71): polled while it is generated, Regenerate in vi / en replaces it. */
export function SummaryPanel({
  meeting,
  segments,
  onSeek,
}: {
  meeting: Meeting
  segments: Segment[]
  onSeek?: (seconds: number) => void
}) {
  const { summary_languages: languages, default_summary_language: defaultLanguage } = useStore(configStore)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [missing, setMissing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [confirmLanguage, setConfirmLanguage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const transcriptReady = meeting.status === 'done'

  const load = useCallback(async () => {
    try {
      setSummary(await api.getSummary(meeting.id))
      setMissing(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true)
      else setRequestError(errorMessage(e))
    } finally {
      setLoaded(true)
    }
  }, [meeting.id])

  // Load once, again when the transcript becomes ready, and every 3 s while the summary is being generated.
  useEffect(() => {
    void load()
  }, [load, meeting.status])
  const running = isRunning(summary)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [running, load])
  // Just transcribed: the summary row may appear a moment after the meeting turns "done".
  useEffect(() => {
    if (!transcriptReady || !missing) return
    const timer = window.setTimeout(() => void load(), POLL_MS)
    return () => window.clearTimeout(timer)
  }, [transcriptReady, missing, load])

  const regenerate = async (language: string) => {
    setRequestError(null)
    try {
      setSummary(await api.regenerateSummary(meeting.id, language))
      setMissing(false)
    } catch (e) {
      setRequestError(errorMessage(e))
    }
  }

  // Replacing an existing summary needs a confirmation; creating or retrying does not.
  const askRegenerate = (language: string) => (summary?.status === 'done' ? setConfirmLanguage(language) : void regenerate(language))

  const copy = async () => {
    if (!summary?.content) return
    await copyText(minutesText(meeting.title, summary.content))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const current = summary?.language ?? defaultLanguage
  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 sm:px-2">
      <p className="text-base text-muted-foreground">
        {summary?.status === 'done'
          ? `${languageName(summary.language)} · ${formatDateTime(summary.updated_at)}${summary.model ? ` · ${summary.model}` : ''}`
          : 'Meeting minutes generated from the transcript.'}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={copy} disabled={summary?.status !== 'done'} aria-label="Copy summary">
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" disabled={!transcriptReady || running}>
              <RefreshCw className="size-4" />
              {summary || !missing ? 'Regenerate' : 'Generate'}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Summary language</DropdownMenuLabel>
            {languages.map((code) => (
              <DropdownMenuItem key={code} onSelect={() => askRegenerate(code)}>
                {languageName(code)}
                {code === current && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  let body: ReactNode
  if (!transcriptReady) {
    body = (
      <Empty>
        {meeting.status === 'failed'
          ? 'The transcript failed, so there is no summary.'
          : 'The summary is generated automatically as soon as the transcript is ready.'}
      </Empty>
    )
  } else if (!loaded) {
    body = <Empty><LoaderCircle className="mx-auto size-5 animate-spin" /></Empty>
  } else if (missing || !summary) {
    body = <Empty>No summary yet. Use Generate to create one.</Empty>
  } else if (running) {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center" role="status">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        <p className="font-medium text-foreground">Summarizing…</p>
        <p className="text-base text-muted-foreground">
          {summary.status === 'pending' ? 'Waiting for the summary model' : `Writing the minutes in ${languageName(summary.language)}`}. Long
          meetings take a few minutes.
        </p>
      </div>
    )
  } else if (summary.status === 'failed') {
    body = (
      <div className="px-3 sm:px-2">
        <Notice
          tone="error"
          icon={<CircleAlert className="size-4" />}
          title="The summary could not be generated"
          action={
            <Button size="sm" variant="secondary" onClick={() => void regenerate(summary.language)}>
              <RefreshCw className="size-3.5" /> Try again
            </Button>
          }
        >
          {summary.error}
        </Notice>
      </div>
    )
  } else if (summary.content) {
    body = <MinutesView minutes={summary.content} segments={segments} onSeek={onSeek} />
  }

  return (
    <div>
      {toolbar}
      {requestError && (
        <div className="px-3 pb-3 sm:px-2">
          <Notice tone="error" icon={<CircleAlert className="size-4" />}>
            {requestError}
          </Notice>
        </div>
      )}
      {body}

      <AlertDialog open={confirmLanguage !== null} onOpenChange={(open) => !open && setConfirmLanguage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the summary?</AlertDialogTitle>
            <AlertDialogDescription>
              The current summary will be replaced by a new one in {languageName(confirmLanguage ?? current)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmLanguage) void regenerate(confirmLanguage)
                setConfirmLanguage(null)
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-14 text-center text-base text-muted-foreground">{children}</div>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-base text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[16px] leading-[1.6] text-foreground">
          <span className="mt-[0.7em] size-1 shrink-0 rounded-[1px] bg-foreground/60" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function MinutesView({ minutes, segments, onSeek }: { minutes: Minutes; segments: Segment[]; onSeek?: (s: number) => void }) {
  const startOf = (idx: number) => segments.find((s) => s.idx === idx)?.start
  return (
    <div className="space-y-6 px-3 pb-4 sm:px-2" data-testid="summary">
      <Section title="Overview">
        <p className="flex gap-2 text-[16px] leading-[1.7] text-foreground">
          <Sparkles className="mt-1 size-4 shrink-0 text-muted-foreground" />
          <span>{minutes.overview}</span>
        </p>
      </Section>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Key points">
          <Bullets items={minutes.key_points} empty="No key points." />
        </Section>
        <Section title="Decisions">
          <Bullets items={minutes.decisions} empty="No decisions were recorded." />
        </Section>
      </div>
      <Section title="Action items">
        {minutes.action_items.length ? (
          <ul className="space-y-1.5">
            {minutes.action_items.map((item, i) => {
              const at = item.segment_ids.length ? startOf(item.segment_ids[0]) : undefined
              return (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[16px] leading-[1.6] text-foreground">
                  <span className="mt-[0.45em] size-2.5 shrink-0 self-start rounded-[2px] border border-foreground/50" />
                  <span className="min-w-0 flex-1">{item.task}</span>
                  {(item.owner || item.due) && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {[item.owner, item.due].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {at !== undefined && onSeek && (
                    <button type="button" onClick={() => onSeek(at)} className="digital text-[15px] text-muted-foreground hover:text-foreground">
                      {formatClock(at)}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-base text-muted-foreground">No action items.</p>
        )}
      </Section>
      <Section title="Open questions">
        <Bullets items={minutes.open_questions} empty="No open questions." />
      </Section>
    </div>
  )
}

function minutesText(title: string, m: Minutes): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '-')
  const actions = m.action_items.map((a) => `- ${a.task}${a.owner ? ` (${a.owner})` : ''}${a.due ? ` - ${a.due}` : ''}`)
  return [
    title,
    '',
    m.overview,
    '',
    'Key points',
    list(m.key_points),
    '',
    'Decisions',
    list(m.decisions),
    '',
    'Action items',
    actions.length ? actions.join('\n') : '-',
    '',
    'Open questions',
    list(m.open_questions),
  ].join('\n')
}
