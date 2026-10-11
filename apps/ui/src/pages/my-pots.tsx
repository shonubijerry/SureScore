import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ListState, Section } from '../components/bits'
import { PotCard } from '../components/pot-card'
import { api } from '../lib/api'
import type { PotCard as Pot } from '../lib/types'
import { useApi } from '../lib/use-api'

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
  const query = useApi<{ pots: Pot[] }>('/api/pots')
  const list = { ...query, data: query.data?.pots ?? null }

  return (
    <Section
      title="My pots"
      action={
        <Link to="/matches" className="text-sm font-semibold">
          + New pot
        </Link>
      }
    >
      <ListState query={list} empty="You haven't created a pot yet. Choose a match to get started.">
        {(pots) =>
          pots.map((pot) =>
            pot.status === 'Draft' ? (
              <PotCard key={pot.id} pot={pot} linked={false}>
                <VerifyFunding pot={pot} onDone={query.reload} />
              </PotCard>
            ) : (
              <PotCard key={pot.id} pot={pot} />
            ),
          )
        }
      </ListState>
    </Section>
  )
}
