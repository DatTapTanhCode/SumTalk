import { CircleAlert, Eye, EyeOff, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { ApiError, NetworkError, errorMessage } from '@/api/client'
import { Logo } from '@/components/Layout'
import { FieldLabel, Notice } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authStore, signIn } from '@/lib/auth'
import { useStore } from '@/lib/store'

/** Only paths inside the app, so a crafted ?next= cannot send people to another site. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/'
}

/** Level-meter bars in the logo's dot-matrix style, for the brand panel. */
const BARS = [3, 5, 8, 6, 10, 7, 12, 9, 5, 8, 11, 6, 4, 7, 9, 5, 3, 6, 8, 4]

function MatrixMeter() {
  return (
    <div className="flex h-[132px] items-end gap-[5px]" aria-hidden>
      {BARS.map((height, column) => (
        <div key={column} className="flex flex-col-reverse gap-[5px]">
          {Array.from({ length: height }, (_, row) => (
            <span
              key={row}
              className="size-[6px] bg-background"
              style={{ opacity: row >= height - 1 ? 1 : 0.25 + (row / height) * 0.6 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LoginPage() {
  const { status } = useStore(authStore)
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Sign in · SumTalk'
    return () => {
      document.title = 'SumTalk'
    }
  }, [])

  if (status === 'signed-in' || status === 'off') return <Navigate to={next} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(username.trim(), password)
    } catch (e) {
      if (e instanceof NetworkError) setError('Cannot reach the server. Check your connection and try again.')
      else if (e instanceof ApiError && e.status === 401) setError('Wrong username or password.')
      else setError(errorMessage(e))
      setPassword('')
      passwordRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh bg-background md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background md:flex">
        <div className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">
          <Logo className="size-9 rounded-md ring-1 ring-background/20" />
          SumTalk
        </div>
        <div className="space-y-8">
          <MatrixMeter />
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-background/60 uppercase">Meeting notes, in any language</p>
            <p className="digital mt-3 max-w-sm text-[44px] leading-[0.95] tracking-tight">Record. Transcribe. Summarize.</p>
          </div>
        </div>
        <p className="font-mono text-[10px] tracking-[0.14em] text-background/50 uppercase">Test server · one shared account</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] md:hidden">
            <Logo className="size-9" />
            SumTalk
          </div>

          <div className="eyebrow text-[11px]">Welcome back</div>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.03em] text-foreground">Sign in</h1>
          <p className="mt-1 text-base text-muted-foreground">Use the account your team shared for the SumTalk test server.</p>

          <form onSubmit={(e) => void submit(e)} className="panel-ticks mt-7 space-y-5 rounded-md border border-border bg-card p-5 sm:p-6" noValidate>
            {error && (
              <div role="alert">
                <Notice tone="error" icon={<CircleAlert className="size-4" />}>
                  {error}
                </Notice>
              </div>
            )}

            <div className="grid gap-1.5">
              <FieldLabel htmlFor="login-username">Username</FieldLabel>
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!username.trim() || !password}>
              {!busy && <Lock className="size-4" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-sm text-muted-foreground">
            Got a share link? It opens without signing in. Forgot the password? Ask the person who set up the server.
          </p>
        </div>
      </main>
    </div>
  )
}
