import { CircleAlert, Download, FileText, Languages, LoaderCircle, RefreshCw } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Meeting, TranslatedSegment, Translation, TranslationExportFormat, TranslationExportMode, TranslationInfo } from '../api/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Notice, ProgressBar, inputClass } from './primitives'
import { cn, formatClock } from '../lib/format'
import { languageName } from '../lib/languages'
import { configStore } from '../lib/server'
import { useStore } from '../lib/store'

const POLL_MS = 2000
const LAST_LANGUAGE_KEY = 'sumtalk.translationLanguage'
const isRunning = (t: { status: string } | null) => t?.status === 'pending' || t?.status === 'running'

const EXPORTS: { format: TranslationExportFormat; mode: TranslationExportMode; label: string }[] = [
  { format: 'txt', mode: 'translated', label: 'Text (.txt)' },
  { format: 'srt', mode: 'translated', label: 'Subtitles (.srt)' },
  { format: 'txt', mode: 'bilingual', label: 'Text, original + translation' },
  { format: 'srt', mode: 'bilingual', label: 'Subtitles, original + translation' },
]

function rememberedLanguage(): string | null {
  try {
    return localStorage.getItem(LAST_LANGUAGE_KEY)
  } catch {
    return null
  }
}

function rememberLanguage(code: string) {
  try {
    localStorage.setItem(LAST_LANGUAGE_KEY, code)
  } catch {
    // private mode: not remembered, that's fine
  }
}

/** Translation tab (#64, #65): pick a target language, follow progress, original | translation side by side, export. */
export function TranslationPanel({ meeting, onSeek }: { meeting: Meeting; onSeek?: (seconds: number) => void }) {
  const languages = useStore(configStore).translation_languages
  const [available, setAvailable] = useState<TranslationInfo[]>([])
  const [lang, setLang] = useState<string | null>(null)
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const langRef = useRef(lang)
  langRef.current = lang
  const transcriptReady = meeting.status === 'done'

  // Opening the meeting again shows a saved translation right away (GET only - nothing is re-translated).
  useEffect(() => {
    if (!transcriptReady) return
    let cancelled = false
    void (async () => {
      try {
        const list = await api.listTranslations(meeting.id)
        if (cancelled) return
        setAvailable(list)
        const preferred = rememberedLanguage()
        const pick = list.find((t) => t.target_lang === preferred) ?? list.find((t) => t.status === 'done') ?? list[0]
        if (pick) {
          setLang(pick.target_lang)
          setTranslation(await api.getTranslation(meeting.id, pick.target_lang))
        }
      } catch (e) {
        if (!cancelled) setRequestError(errorMessage(e))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meeting.id, transcriptReady])

  const refresh = useCallback(async () => {
    const current = langRef.current
    if (!current) return
    try {
      const next = await api.getTranslation(meeting.id, current)
      if (langRef.current === current) setTranslation(next)
    } catch (e) {
      setRequestError(errorMessage(e))
    }
  }, [meeting.id])

  const running = isRunning(translation)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [running, refresh])

  const choose = async (code: string) => {
    setRequestError(null)
    setLang(code)
    rememberLanguage(code)
    setTranslation(null)
    try {
      // Returns the saved translation if there is one; starts translating otherwise.
      const result = await api.createTranslation(meeting.id, code)
      if (langRef.current !== code) return
      setTranslation(result)
      setAvailable((list) => [...list.filter((t) => t.target_lang !== code), result])
    } catch (e) {
      setRequestError(errorMessage(e))
    }
  }

  const retry = async () => {
    if (!lang) return
    setRequestError(null)
    try {
      setTranslation(await api.retryTranslation(meeting.id, lang))
    } catch (e) {
      setRequestError(errorMessage(e))
    }
  }

  if (!transcriptReady) {
    return (
      <div className="px-6 py-14 text-center text-base text-muted-foreground">
        {meeting.status === 'failed' ? 'The transcript failed, so it cannot be translated.' : 'Translation is available once the transcript is ready.'}
      </div>
    )
  }

  const done = translation?.status === 'done'
  const translatedCount = translation?.segments.filter((s) => s.translation !== null).length ?? 0
  const statusOf = (code: string) => available.find((t) => t.target_lang === code)?.status

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-2">
        <label className="flex items-center gap-2 text-base text-muted-foreground">
          <Languages className="size-4" />
          <span>Translate to</span>
          <select
            aria-label="Target language"
            value={lang ?? ''}
            onChange={(e) => e.target.value && void choose(e.target.value)}
            className={cn(inputClass, 'w-auto py-1.5 pr-8')}
          >
            {!lang && <option value="">Choose a language…</option>}
            {languages.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
                {statusOf(code) === 'done' ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" disabled={!done}>
              <Download className="size-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {EXPORTS.map(({ format, mode, label }, i) => (
              <Fragment key={`${format}-${mode}`}>
                {i === 2 && <DropdownMenuSeparator />}
                <DropdownMenuItem asChild>
                  <a href={lang ? api.translationExportUrl(meeting.id, lang, format, mode) : undefined} download className="gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    {label}
                  </a>
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {requestError && (
        <div className="px-3 sm:px-2">
          <Notice tone="error" icon={<CircleAlert className="size-4" />}>
            {requestError}
          </Notice>
        </div>
      )}

      {running && translation && (
        <div className="space-y-2 px-3 sm:px-2" role="status">
          <div className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Translating into {languageName(translation.target_lang)}…
            </span>
            <span className="font-mono text-muted-foreground tabular-nums">{translation.progress}%</span>
          </div>
          <ProgressBar value={translation.progress / 100} />
        </div>
      )}

      {translation?.status === 'failed' && (
        <div className="px-3 sm:px-2">
          <Notice
            tone="error"
            icon={<CircleAlert className="size-4" />}
            title="The translation stopped"
            action={
              <Button size="sm" variant="secondary" onClick={() => void retry()}>
                <RefreshCw className="size-3.5" /> Try again
              </Button>
            }
          >
            {translation.error}
            {translatedCount > 0 && ` ${translatedCount} line${translatedCount === 1 ? ' is' : 's are'} already translated and will be kept.`}
          </Notice>
        </div>
      )}

      {!loaded ? (
        <div className="flex justify-center py-14 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : !lang ? (
        <div className="px-6 py-14 text-center text-base text-muted-foreground">
          Choose a language to translate the transcript. Lines already in that language are kept as they are.
        </div>
      ) : !translation ? (
        <div className="flex justify-center py-14 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : translation.segments.length === 0 ? (
        <div className="px-6 py-14 text-center text-base text-muted-foreground">The transcript has no lines to translate.</div>
      ) : (
        <SideBySide translation={translation} onSeek={onSeek} />
      )}
    </div>
  )
}

function SideBySide({ translation, onSeek }: { translation: Translation; onSeek?: (seconds: number) => void }) {
  const target = languageName(translation.target_lang)
  return (
    <div role="table" aria-label="Original and translation" data-testid="translation-table">
      <div role="row" className="hidden grid-cols-2 gap-4 border-b border-border px-3 pb-2 md:grid">
        <div role="columnheader" className="pl-[4.75rem] font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Original
        </div>
        <div role="columnheader" className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Translation · {target}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {translation.segments.map((segment) => (
          <Row key={segment.segment_id} segment={segment} target={target} onSeek={onSeek} />
        ))}
      </div>
    </div>
  )
}

function Row({ segment, target, onSeek }: { segment: TranslatedSegment; target: string; onSeek?: (seconds: number) => void }) {
  const clock = formatClock(segment.start)
  return (
    <div role="row" className="grid gap-1.5 px-3 py-2.5 md:grid-cols-2 md:gap-4">
      <div role="cell" className="flex min-w-0 gap-3">
        {onSeek ? (
          <button
            type="button"
            onClick={() => onSeek(segment.start)}
            className="digital w-16 shrink-0 pt-0.5 text-left text-[16px] leading-none text-muted-foreground/80 hover:text-foreground"
            aria-label={`Play from ${clock}`}
          >
            {clock}
          </button>
        ) : (
          <span className="digital w-16 shrink-0 pt-0.5 text-[16px] leading-none text-muted-foreground/80">{clock}</span>
        )}
        <p className="min-w-0 flex-1 text-[16px] leading-[1.7] text-foreground">
          {segment.speaker && <span className="font-medium">{segment.speaker}: </span>}
          {segment.original}
        </p>
      </div>
      <div role="cell" className="min-w-0 pl-[4.75rem] md:pl-0">
        {segment.translation === null ? (
          <span className="inline-block h-4 w-2/3 animate-pulse rounded-[2px] bg-secondary align-middle" aria-label="Not translated yet" />
        ) : (
          <p className="text-[16px] leading-[1.7] text-foreground">
            {segment.translation}
            {segment.skipped && (
              <span
                className="ml-2 inline-block rounded-[2px] border border-border px-1 align-middle font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase"
                title={`This line was already in ${target}, so it was kept unchanged`}
              >
                already {target}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
