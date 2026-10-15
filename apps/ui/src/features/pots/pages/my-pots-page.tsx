import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ListState, Section } from '../../../components/bits'
import { PotCard } from '../components/pot-card'
import { ShareButtons } from '../components/share-buttons'
import { api } from '../../../lib/api'
import type { PotCard as Pot } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

/** A Draft pot is awaiting payment; it stays out of discovery until funding is verified. */
function VerifyFunding({ pot, onDone }: { pot: Pot; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function verify() {
    setBusy(true)
    setMessage('')
    try {
      await api(`/api/pots/${pot.id}/verify-funding`, { method: 'POST' })
      onDone()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Awaiting payment. Once you've paid, verify to open the pot.</p>
      <Button size="sm" onClick={verify} disabled={busy}>
        {busy ? 'Checking…' : 'Verify payment'}
      </Button>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}

export default function MyPotsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const verifyPotId = searchParams.get('verifyPotId')
  const [autoVerifying, setAutoVerifying] = useState(Boolean(verifyPotId))
  const [autoVerifyStatus, setAutoVerifyStatus] = useState<{ isError: boolean; message: string } | null>(null)

  const showCancelled = searchParams.get('cancelled') === '1'
  const toggleCancelled = (show: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (show) next.set('cancelled', '1')
    else next.delete('cancelled')
    setSearchParams(next, { replace: true })
  }
  const query = useApi<{ pots: Pot[] }>(`/api/pots${showCancelled ? '?includeCancelled=true' : ''}`)
  const list = { ...query, data: query.data?.pots ?? null }

  useEffect(() => {
    if (!verifyPotId) return

    let active = true
    setAutoVerifying(true)
    setAutoVerifyStatus(null)

    api(`/api/pots/${verifyPotId}/verify-funding`, { method: 'POST' })
      .then(() => {
        if (!active) return
        setAutoVerifyStatus({ isError: false, message: 'Payment confirmed! Your pot is now open.' })
        query.reload()
      })
      .catch((err: Error) => {
        if (!active) return
        setAutoVerifyStatus({ isError: true, message: err.message || 'Payment verification failed. You can retry below.' })
      })
      .finally(() => {
        if (!active) return
        setAutoVerifying(false)
        const next = new URLSearchParams(searchParams)
        next.delete('verifyPotId')
        next.delete('reference')
        next.delete('trxref')
        setSearchParams(next, { replace: true })
      })

    return () => {
      active = false
    }
  }, [verifyPotId])

  return (
    <Section
      title="My pots"
      action={
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            Bank Accounts
          </Link>
          <Link to="/matches" className="text-sm font-semibold">
            + New pot
          </Link>
        </div>
      }
    >
      {autoVerifying && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm font-medium text-primary">
          Verifying payment with payment provider…
        </div>
      )}
      {autoVerifyStatus && !autoVerifying && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm font-medium ${
            autoVerifyStatus.isError
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {autoVerifyStatus.message}
        </div>
      )}

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" className="size-4 accent-primary" checked={showCancelled} onChange={(e) => toggleCancelled(e.target.checked)} />
        Show cancelled pots
      </label>

      <ListState
        query={list}
        empty={showCancelled ? "You haven't created a pot yet. Choose a match to get started." : 'No active pots. Choose a match to create one, or show cancelled pots.'}
      >
        {(pots) =>
          pots.map((pot) =>
            pot.status === 'Draft' ? (
              <PotCard key={pot.id} pot={pot} linked={false}>
                <VerifyFunding pot={pot} onDone={query.reload} />
              </PotCard>
            ) : (
              <PotCard key={pot.id} pot={pot}>
                {['Open', 'Locked', 'Live'].includes(pot.status) && <ShareButtons pot={pot} />}
              </PotCard>
            ),
          )
        }
      </ListState>
    </Section>
  )
}
