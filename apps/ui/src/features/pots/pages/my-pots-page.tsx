import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Section } from '../../../components/bits'
import { PotList } from '../components/pot-list'
import { ShareButtons } from '../components/share-buttons'
import { api } from '../../../lib/api'
import type { PotCard as Pot } from '../../../lib/types'
import { usePaged } from '../../../lib/use-paged'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'created', label: 'Created' },
  { key: 'predicted', label: 'Predicted' },
] as const
type Filter = (typeof FILTERS)[number]['key']

const EMPTY: Record<Filter, string> = {
  all: "You haven't created or predicted on a pot yet. Choose a match to get started.",
  created: "You haven't created a pot yet. Choose a match to get started.",
  predicted: "You haven't predicted on anyone else's pot yet.",
}

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

  const filter: Filter = FILTERS.find((f) => f.key === searchParams.get('view'))?.key ?? 'all'
  const selectFilter = (key: Filter) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'all') next.delete('view')
    else next.set('view', key)
    setSearchParams(next, { replace: true })
  }

  const list = usePaged<Pot, 'pots'>(`/api/pots?role=${filter}${showCancelled ? '&includeCancelled=true' : ''}`, 'pots')

  useEffect(() => {
    if (!verifyPotId) return

    let active = true
    setAutoVerifying(true)
    setAutoVerifyStatus(null)

    api(`/api/pots/${verifyPotId}/verify-funding`, { method: 'POST' })
      .then(() => {
        if (!active) return
        setAutoVerifyStatus({ isError: false, message: 'Payment confirmed! Your pot is now open.' })
        list.reload()
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

      <div role="radiogroup" aria-label="Show pots" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="radio"
            aria-checked={f.key === filter}
            onClick={() => selectFilter(f.key)}
            className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
              f.key === filter ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" className="size-4 accent-primary" checked={showCancelled} onChange={(e) => toggleCancelled(e.target.checked)} />
        Show cancelled pots
      </label>

      <PotList
        list={list}
        empty={showCancelled ? EMPTY[filter] : `${EMPTY[filter]} Cancelled pots are hidden.`}
        linked={(pot) => pot.status !== 'Draft'}
        extra={(pot) =>
          pot.isPotter &&
          (pot.status === 'Draft' ? (
            <VerifyFunding pot={pot} onDone={list.reload} />
          ) : (
            ['Open', 'Locked', 'Live'].includes(pot.status) && <ShareButtons pot={pot} />
          ))
        }
      />
    </Section>
  )
}
