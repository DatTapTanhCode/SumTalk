import { useState } from 'react'
import { X } from 'lucide-react'
import { api, errorMessage } from '@/api/client'
import type { Meeting } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function MeetingTags({ meeting, onSaved }: { meeting: Meeting; onSaved: (meeting: Meeting) => void }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(name: string, remove = false) {
    if (!name || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = remove ? await api.removeTag(meeting.id, name) : await api.addTag(meeting.id, name)
      onSaved(updated)
      if (!remove) setDraft('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Private tags" className="space-y-2">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(draft.trim()) }}>
        <label className="text-sm font-medium" htmlFor="meeting-tag">Private tags</label>
        {meeting.tags.map((name) => (
          <button type="button" key={name} disabled={busy} onClick={() => void save(name, true)}
            aria-label={`Remove tag ${name}`} className="flex max-w-full items-center gap-1 rounded bg-secondary px-2 py-1 text-sm">
            <span className="truncate">{name}</span><X className="size-3 shrink-0" />
          </button>
        ))}
        <Input id="meeting-tag" className="w-40" maxLength={64} value={draft} disabled={busy}
          placeholder="Project or client" onChange={(e) => setDraft(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={busy || !draft.trim()}>Add tag</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
