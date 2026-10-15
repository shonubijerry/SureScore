import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { leagueName } from '../../../lib/format'
import { potShareUrl } from '../share'
import type { PotCard } from '../../../lib/types'

/** Copy the pot link, or open the device share sheet where available. */
export function ShareButtons({ pot }: { pot: PotCard }) {
  const [copied, setCopied] = useState(false)
  const url = potShareUrl(pot)
  if (!url) return null

  const title = `${pot.match.homeTeam} vs ${pot.match.awayTeam}`
  const text = `Predict ${title} (${leagueName(pot.match.league)}) on SureScore and win a share of the pot!`
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!)
    } catch {
      // Clipboard API unavailable (insecure context or denied): fall back to a prompt the user can copy from.
      window.prompt('Copy this link', url!)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    try {
      await navigator.share({ title, text, url: url! })
    } catch (error) {
      // The user dismissing the share sheet is not an error.
      if ((error as DOMException).name !== 'AbortError') await copy()
    }
  }

  return (
    <div className="space-y-2">
      {pot.isPrivate && <p className="text-xs text-muted-foreground">Private pot: only people with this link can view and join.</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
        {canShare && (
          <Button type="button" className="h-11 flex-1" onClick={share}>
            <Share2 aria-hidden /> Share
          </Button>
        )}
      </div>
    </div>
  )
}
