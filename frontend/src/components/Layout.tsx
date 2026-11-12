import { Cloud, CloudUpload, Cpu, ListChecks, LoaderCircle, Mic, Plus, TriangleAlert, Upload, WifiOff, Zap } from 'lucide-react'
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

/** Connection readout. `quiet` hides it while everything is fine (mobile top bar). */
function ConnectionChip({ className, quiet = false }: { className?: string; quiet?: boolean }) {
  const sync = useStore(syncStore)
  const { reachable } = useStore(healthStore)
  const pending = Object.values(sync.pending).reduce((a, b) => a + b, 0)
  const offline = !sync.online || reachable === false

  if (offline) {
    return (
      <Readout
        className={cn('border-border bg-card text-foreground', className)}
        title="Recordings are kept on this device and upload automatically when the connection is back."
      >
        <WifiOff className="size-3" />
        <Dot className="bg-live" />
        {sync.online ? 'No server' : 'Offline'}
        {pending > 0 && <span className="tabular-nums">· {pending}</span>}
      </Readout>
    )
  }
  if (pending > 0) {
    return (
      <Readout className={cn('border-border bg-card text-foreground', className)} title="Uploading recorded audio">
        <CloudUpload className="size-3" />
        <span className="tabular-nums">{pending}</span>
        queued
      </Readout>
    )
  }
  if (quiet) return null
  return (
    <Readout className={cn('border-border bg-card text-muted-foreground', className)} title="Connected">
      <Dot className="bg-online" />
      Online
    </Readout>
  )
}

function ModelChip({ className }: { className?: string }) {
  const { stt, reachable } = useStore(healthStore)
  if (!stt || reachable === false) return null
  if (stt.status === 'error') {
    return (
      <Readout className={cn('border-live/40 bg-card text-live', className)} title={stt.error ?? ''}>
        <TriangleAlert className="size-3" />
        Speech model error
      </Readout>
    )
  }
  if (stt.status !== 'ready') {
    return (
      <Readout className={cn('border-border bg-card text-muted-foreground', className)} title="The first start downloads the Whisper model">
        <LoaderCircle className="size-3 animate-spin" />
        Loading model
      </Readout>
    )
  }
  const gpu = stt.device === 'cuda'
  const remote = stt.device === 'remote' // STT_PROVIDER=remote: compute_type holds the API host
  return (
    <Readout
      className={cn('border-border bg-card text-muted-foreground', className)}
      title={remote ? `Speech API · ${stt.model} · ${stt.compute_type}` : `faster-whisper · ${stt.model} · ${stt.device} · ${stt.compute_type}`}
    >
      {remote ? <Cloud className="size-3 text-foreground" /> : gpu ? <Zap className="size-3 text-foreground" /> : <Cpu className="size-3" />}
      {remote ? `${stt.model} · Server` : `Whisper ${stt.model} · ${gpu ? 'GPU' : 'CPU'}`}
    </Readout>
  )
}

function RecordingPill({ className }: { className?: string }) {
  const session = useStore(sessionStore)
  const { pathname } = useLocation()
  if ((session.phase !== 'recording' && session.phase !== 'paused') || pathname === '/record') return null
  return (
    <Link
      to="/record"
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-live px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-live/90',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-[1px] bg-white', session.phase === 'recording' && 'animate-pulse')} />
      {session.phase === 'paused' ? 'Paused' : 'Rec'}
      <span className="digital ml-auto text-xl tracking-normal tabular-nums">{formatClock(session.seconds)}</span>
    </Link>
  )
}

export function Layout() {
  const session = useStore(sessionStore)
  const recording = session.phase === 'recording' || session.phase === 'paused'

  return (
    <div className="min-h-dvh md:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background/80 backdrop-blur-md md:flex">
        <Link to="/" className="flex h-14 shrink-0 items-center gap-2 px-4 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
          <Logo className="size-8" live={session.phase === 'recording'} />
          SumTalk
          <span className="rounded-[3px] border border-border px-1 py-px font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            poc
          </span>
        </Link>

        <div className="px-3 pt-2 pb-4">
          <Link
            to="/record"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <Plus className="size-4" /> New recording
          </Link>
        </div>

        <div className="eyebrow px-4 pb-2 text-[10px]">Menu</div>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'row-rule flex h-9 items-center gap-2.5 rounded-md px-3 text-[15px] font-medium tracking-tight transition-colors',
                  isActive
                    ? 'bg-card font-semibold text-foreground shadow-[inset_2px_0_0_0_var(--foreground)] hover:shadow-[inset_2px_0_0_0_var(--foreground)]'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )
              }
            >
              <Icon className="size-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pt-4">
          <RecordingPill className="w-full" />
        </div>

        <div className="mt-auto space-y-2 border-t border-border px-3 py-3">
          <div className="eyebrow text-[10px]">System</div>
          <div className="flex flex-col items-start gap-1.5">
            <ConnectionChip />
            <ModelChip />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            <Logo className="size-8" live={session.phase === 'recording'} />
            SumTalk
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <RecordingPill />
            <ConnectionChip quiet />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
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
