import { CloudUpload, Cpu, ListChecks, LoaderCircle, Mic, TriangleAlert, Upload, WifiOff, Zap } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { sessionStore } from '../audio/session'
import { cn, formatClock } from '../lib/format'
import { healthStore } from '../lib/server'
import { useStore } from '../lib/store'
import { syncStore } from '../offline/sync'

const NAV = [
  { to: '/', label: 'Meetings', icon: ListChecks, end: true },
  { to: '/record', label: 'Record', icon: Mic, end: false },
  { to: '/upload', label: 'Upload', icon: Upload, end: false },
]

/** Dot-matrix level meter. The red dot only exists while something is live. */
const LOGO_COLUMNS: number[][] = [
  [1, 2],
  [0, 1, 2, 3],
  [0, 1, 2],
  [1, 2, 3],
  [2, 3],
]

export function Logo({ className, live = false }: { className?: string; live?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0a0a0a" />
      {LOGO_COLUMNS.map((rows, column) =>
        rows.map((row) => (
          <rect
            key={`${column}-${row}`}
            x={2.2 + column * 5.8}
            y={5.1 + row * 5.8}
            width="4.4"
            height="4.4"
            fill="#fafaf8"
          />
        )),
      )}
      {live && <circle cx="27" cy="5.5" r="2.8" fill="#d71921" />}
    </svg>
  )
}

function Readout({
  className,
  title,
  children,
}: {
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-[0.1em] uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

function Dot({ className }: { className?: string }) {
  return <span className={cn('size-1.5 shrink-0 rounded-[1px]', className)} />
}

function ConnectionChip() {
  const sync = useStore(syncStore)
  const { reachable } = useStore(healthStore)
  const pending = Object.values(sync.pending).reduce((a, b) => a + b, 0)
  const offline = !sync.online || reachable === false

  if (offline) {
    return (
      <Readout
        className="border-border bg-card text-foreground"
        title="Recordings are kept on this device and upload automatically when the connection is back."
      >
        <WifiOff className="size-3" />
        <Dot className="bg-live" />
        <span className="hidden sm:inline">{sync.online ? 'No server' : 'Offline'}</span>
        {pending > 0 && <span className="tabular-nums">· {pending}</span>}
      </Readout>
    )
  }
  if (pending > 0) {
    return (
      <Readout className="border-border bg-card text-foreground" title="Uploading recorded audio">
        <CloudUpload className="size-3" />
        <span className="tabular-nums">{pending}</span>
        <span className="hidden sm:inline">queued</span>
      </Readout>
    )
  }
  return (
    <Readout className="hidden border-border bg-card text-muted-foreground sm:inline-flex" title="Connected">
      <Dot className="bg-online" />
      <span className="hidden sm:inline">Online</span>
    </Readout>
  )
}

function ModelChip() {
  const { stt, reachable } = useStore(healthStore)
  if (!stt || reachable === false) return null
  if (stt.status === 'error') {
    return (
      <Readout className="border-live/40 bg-card text-live" title={stt.error ?? ''}>
        <TriangleAlert className="size-3" />
        <span className="hidden sm:inline">Speech model error</span>
      </Readout>
    )
  }
  if (stt.status !== 'ready') {
    return (
      <Readout className="border-border bg-card text-muted-foreground" title="The first start downloads the Whisper model">
        <LoaderCircle className="size-3 animate-spin" />
        <span className="hidden sm:inline">Loading model</span>
      </Readout>
    )
  }
  const gpu = stt.device === 'cuda'
  return (
    <span className="hidden lg:contents">
      <Readout
        className="border-border bg-card text-muted-foreground"
        title={`faster-whisper · ${stt.model} · ${stt.device} · ${stt.compute_type}`}
      >
        {gpu ? <Zap className="size-3 text-foreground" /> : <Cpu className="size-3" />}
        Whisper {stt.model} · {gpu ? 'GPU' : 'CPU'}
      </Readout>
    </span>
  )
}

function RecordingPill() {
  const session = useStore(sessionStore)
  const { pathname } = useLocation()
  if ((session.phase !== 'recording' && session.phase !== 'paused') || pathname === '/record') return null
  return (
    <Link
      to="/record"
      className="inline-flex items-center gap-2 rounded-md bg-live px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-live/90"
    >
      <span className={cn('size-1.5 rounded-[1px] bg-white', session.phase === 'recording' && 'animate-pulse')} />
      {session.phase === 'paused' ? 'Paused' : 'Rec'}
      <span className="digital text-xl tracking-normal tabular-nums">{formatClock(session.seconds)}</span>
    </Link>
  )
}

export function Layout() {
  const session = useStore(sessionStore)
  const recording = session.phase === 'recording' || session.phase === 'paused'

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            <Logo className="size-8" live={session.phase === 'recording'} />
            SumTalk
            <span className="rounded-[3px] border border-border px-1 py-px font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              poc
            </span>
          </Link>
          <nav className="hidden h-full items-center gap-0.5 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={cn(
                  'relative inline-flex h-full items-center gap-2 px-3 text-[15px] font-medium tracking-tight transition-colors',
                  'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity',
                  'text-muted-foreground hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <RecordingPill />
            <ConnectionChip />
            <ModelChip />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pb-12">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 font-mono text-[11px] tracking-[0.08em] uppercase',
                  isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )
              }
            >
              {to === '/record' ? (
                <span
                  className={cn(
                    '-mt-5 grid size-11 place-items-center rounded-md bg-primary text-primary-foreground ring-4 ring-background',
                    recording && 'ring-live/25',
                  )}
                >
                  <Icon className="size-5" />
                </span>
              ) : (
                <Icon className="size-5" />
              )}
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
