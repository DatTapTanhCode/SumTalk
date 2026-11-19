import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { api, errorMessage } from '@/api/client'
import type { ShareLink } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/clipboard'

function ShareControls({ id }: { id: string }) {
  const [share, setShare] = useState<ShareLink | null>()
  const [includeAudio, setIncludeAudio] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let active = true
    api.getShare(id).then((link) => {
      if (active) {
        setShare(link)
        setIncludeAudio(link?.include_audio ?? false)
      }
    }).catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [id])

  async function change(audio: boolean, revoke = false) {
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      if (revoke) {
        await api.revokeShare(id)
        setShare(null)
        setIncludeAudio(false)
      } else {
        const link = await api.setShare(id, audio)
        setShare(link)
        setIncludeAudio(link.include_audio)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const url = share ? new URL(`/share/${share.token}`, window.location.origin).href : ''
  return (
    <>
      {share !== undefined && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeAudio} disabled={busy} onChange={(e) => {
            if (share) void change(e.target.checked)
            else setIncludeAudio(e.target.checked)
          }} />
          Include audio
        </label>
      )}
      {share === undefined && !error && <p role="status">Loading sharing settings…</p>}
      {share === null && <Button disabled={busy} onClick={() => void change(includeAudio)}>Create share link</Button>}
      {share && (
        <>
          <Input readOnly aria-label="Read-only share link" value={url} onFocus={(e) => e.target.select()} />
          {['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && (
            <p className="text-sm text-muted-foreground">This address opens on this device. If this server is reachable on your network, replace the loopback address in the link with its network address.</p>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void change(false, true)}>Turn off link</Button>
            <Button disabled={busy} onClick={async () => {
              try { await copyText(url); setCopied(true) } catch { setError('Select the link above and copy it manually.') }
            }}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </>
  )
}

export function MeetingShare({ id }: { id: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><Share2 className="size-4" /> Share</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share meeting</DialogTitle>
          <DialogDescription>Anyone with the link can read the summary, action items, transcript, and available translations.</DialogDescription>
        </DialogHeader>
        <ShareControls id={id} />
      </DialogContent>
    </Dialog>
  )
}
