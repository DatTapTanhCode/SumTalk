import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { Layout } from './components/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { sessionStore } from './audio/session'
import { authStore } from './lib/auth'
import { useStore } from './lib/store'
import { LoginPage } from './pages/LoginPage'
import { MeetingPage } from './pages/MeetingPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecordPage } from './pages/RecordPage'
import { SharedMeetingPage } from './pages/SharedMeetingPage'
import { UploadPage } from './pages/UploadPage'

function MeetingRoute() {
  const { id = '' } = useParams()
  return <MeetingPage key={id} id={id} />
}

/** Sends signed-out visitors to the sign-in page, then back to where they were. */
function RequireSignIn({ children }: { children: ReactNode }) {
  const { status } = useStore(authStore)
  const { phase } = useStore(sessionStore)
  const location = useLocation()
  // Never interrupt a recording: its audio stays on this device and uploads after signing in again.
  const recording = phase !== 'idle'
  if (status === 'checking') {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground" role="status" aria-label="Loading">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    )
  }
  if (status === 'signed-out' && !recording) {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return children
}

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <Routes>
          <Route path="share/:token" element={<SharedMeetingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <RequireSignIn>
                <Layout />
              </RequireSignIn>
            }
          >
            <Route index element={<MeetingsPage />} />
            <Route path="record" element={<RecordPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="meetings/:id" element={<MeetingRoute />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  )
}
