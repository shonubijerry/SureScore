import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { isMatchBookable, MAX_WINNER_COUNT, MIN_WINNER_COUNT } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNote, Loading, Section } from '../components/bits'
import { MatchHeader } from '../components/match-card'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatMoney, toMinorUnits } from '../lib/format'
import type { Country, Match, PotCard } from '../lib/types'
import { useApi } from '../lib/use-api'

// PRD: 10% platform fee, 90% winner pool; 50/30/20 default split for three winners.
const PLATFORM_FEE = 0.1
const SPLITS: Record<number, number[]> = { 1: [1], 3: [0.5, 0.3, 0.2] }

const WINNER_OPTIONS = Array.from({ length: MAX_WINNER_COUNT - MIN_WINNER_COUNT + 1 }, (_, i) => MIN_WINNER_COUNT + i)

function Payouts({ prize, winners, currency }: { prize: number; winners: number; currency: string }) {
  const pool = prize * (1 - PLATFORM_FEE)
  const split = SPLITS[winners]
  return (
    <ul className="space-y-1 rounded-2xl bg-muted p-3 text-sm">
      <li>Platform fee (10%): {formatMoney(prize * PLATFORM_FEE, currency)}</li>
      <li>Winner pool (90%): {formatMoney(pool, currency)}</li>
      {split?.map((share, i) => (
        <li key={i} className="font-semibold">
          Place {i + 1}: {formatMoney(pool * share, currency)}
        </li>
      ))}
    </ul>
  )
}

export default function CreatePotPage() {
  const matchId = useSearchParams()[0].get('match')
  const { user } = useAuth()
  const navigate = useNavigate()
  const match = useApi<{ match: Match }>(matchId ? `/api/sports/matches/${encodeURIComponent(matchId)}` : null)

  const countries = useApi<Country[]>('/api/config/countries')
  const [amount, setAmount] = useState('')
  const [winners, setWinners] = useState(3)
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)

  if (!matchId) return <Navigate to="/matches" replace />
  if (match.loading) return <Loading />
  if (match.error || !match.data) return <ErrorNote error={match.error ?? new Error('Match not found.')} onRetry={match.reload} />

  const m = match.data.match
  const bookable = isMatchBookable(m.status, new Date(m.kickoffTimeUtc), new Date())
  const prize = toMinorUnits(Number(amount))
  const validAmount = Number.isFinite(prize) && prize > 0
  const currency = countries.data?.find((c) => c.code === user?.countryCode)?.currency

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await api<{ pot: PotCard; checkoutUrl?: string }>('/api/pots', {
        body: {
          eventId: m.cacheId,
          prizeAmountMinorUnits: prize,
          winnerCount: winners,
          callbackUrl: `${window.location.origin}/my-pots`,
        },
      })
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl)
      else navigate('/my-pots')
    } catch (e) {
      setError(e as Error)
      setSaving(false)
    }
  }

  return (
    <Section title="Create a pot">
      <Card size="sm">
        <CardContent>
          <MatchHeader match={m} />
        </CardContent>
      </Card>

      {!bookable ? (
        <p className="text-sm text-destructive">
          This match is no longer open for new pots. <Link to="/matches" className="underline">Pick another</Link>.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Prize amount</span>
            <input
              required
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-transparent px-4 text-lg"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Number of winners</legend>
            <div className="grid grid-cols-3 gap-2">
              {WINNER_OPTIONS.map((n) => (
                <Button key={n} type="button" size="lg" className="h-12" variant={n === winners ? 'default' : 'outline'} onClick={() => setWinners(n)}>
                  {n}
                </Button>
              ))}
            </div>
          </fieldset>

          {validAmount && currency && <Payouts prize={prize} winners={winners} currency={currency} />}
          <p className="text-xs text-muted-foreground">
            You fund the prize up front. You can cancel until 20 minutes before kickoff; predictions lock 15 minutes before kickoff.
          </p>

          {error && <ErrorNote error={error} />}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving || !validAmount}>
            {saving ? 'Creating…' : 'Create & pay'}
          </Button>
        </form>
      )}
    </Section>
  )
}
