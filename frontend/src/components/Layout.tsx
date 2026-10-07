import { CloudUpload, Cpu, ListChecks, LoaderCircle, Mic, TriangleAlert, Upload, Wifi, WifiOff, Zap } from 'lucide-react'
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

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#4f46e5" />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="36">
        <path d="M136 220v72" />
        <path d="M206 168v176" />
        <path d="M276 128v256" />
        <path d="M346 188v136" />
      </g>
      <circle cx="396" cy="128" r="34" fill="#fb7185" />
    </svg>
  )
}

function Chip({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1', className)}>
      {children}
    </span>
  )
}

function ConnectionChip() {
  const sync = useStore(syncStore)
  const { reachable } = useStore(healthStore)
  const pending = Object.values(sync.pending).reduce((a, b) => a + b, 0)
  const offline = !sync.online || reachable === false

  if (offline) {
    return (
      <Chip className="bg-amber-50 text-amber-800 ring-amber-200" title="Recordings are kept on this device and upload automatically when the connection is back.">
        <WifiOff className="size-3.5" />
        <span className="hidden sm:inline">{sync.online ? 'Server unreachable' : 'Offline'}</span>
        {pending > 0 && <span className="tabular-nums">· {pending} saved</span>}
      </Chip>
    )
  }
  if (pending > 0) {
    return (
      <Chip className="bg-sky-50 text-sky-800 ring-sky-200" title="Uploading recorded audio">
        <CloudUpload className="size-3.5" />
        <span className="tabular-nums">{pending}</span>
        <span className="hidden sm:inline">to upload</span>
      </Chip>
    )
  }
  return (
    <Chip className="bg-white text-slate-600 ring-slate-200" title="Connected">
      <Wifi className="size-3.5 text-emerald-500" />
      <span className="hidden sm:inline">Online</span>
    </Chip>
  )
}

function ModelChip() {
  const { stt, reachable } = useStore(healthStore)
  if (!stt || reachable === false) return null
  if (stt.status === 'error') {
    return (
      <Chip className="bg-red-50 text-red-700 ring-red-200" title={stt.error ?? ''}>
        <TriangleAlert className="size-3.5" />
        <span className="hidden sm:inline">Speech model error</span>
      </Chip>
    )
  }
  if (stt.status !== 'ready') {
    return (
      <Chip className="bg-white text-slate-600 ring-slate-200" title="The first start downloads the Whisper model">
        <LoaderCircle className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">Loading speech model…</span>
      </Chip>
    )
  }
  const gpu = stt.device === 'cuda'
  return (
    <span className="hidden lg:contents">
      <Chip className="bg-white text-slate-600 ring-slate-200" title={`faster-whisper · ${stt.model} · ${stt.device} · ${stt.compute_type}`}>
        {gpu ? <Zap className="size-3.5 text-amber-500" /> : <Cpu className="size-3.5 text-slate-400" />}
        Whisper {stt.model} · {gpu ? 'GPU' : 'CPU'}
      </Chip>
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
      className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
    >
      <span className={cn('size-2 rounded-full bg-white', session.phase === 'recording' && 'animate-pulse')} />
      {session.phase === 'paused' ? 'PAUSED' : 'REC'} <span className="font-mono tabular-nums">{formatClock(session.seconds)}</span>
    </Link>
  )
}

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-slate-900">
            <Logo className="size-7" />
            SumTalk
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">POC</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <RecordingPill />
            <ConnectionChip />
            <ModelChip />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pb-12">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive ? 'text-indigo-600' : 'text-slate-500')
              }
            >
              {to === '/record' ? (
                <span className="-mt-5 grid size-12 place-items-center rounded-full bg-rose-600 text-white shadow-lg ring-4 ring-white">
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
