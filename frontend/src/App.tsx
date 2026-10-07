import { BrowserRouter, Route, Routes, useParams } from 'react-router'
import { Layout } from './components/Layout'
import { MeetingPage } from './pages/MeetingPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecordPage } from './pages/RecordPage'
import { UploadPage } from './pages/UploadPage'

function MeetingRoute() {
  const { id = '' } = useParams()
  return <MeetingPage key={id} id={id} />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MeetingsPage />} />
          <Route path="record" element={<RecordPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="meetings/:id" element={<MeetingRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
