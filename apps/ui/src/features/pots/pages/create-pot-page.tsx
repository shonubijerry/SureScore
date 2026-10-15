import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_PRIZE_SPLITS,
  getBankName,
  isMatchBookable,
  MAX_WINNER_COUNT,
  MIN_WINNER_COUNT,
  PLATFORM_FEE_PERCENT,
  refundAmountFor,
  splitPrizePool,
  WINNER_POOL_PERCENT,
} from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNote, Loading, Section } from '../../../components/bits'
import { MatchHeader } from '../../matches/components/match-card'
import { PayoutAccountModal } from '../../account/components/payout-account-modal'
import { api } from '../../../lib/api'
import { useAuth } from '../../auth/auth-context'
import { formatMoney, toMinorUnits } from '../../../lib/format'
import type { Country, Match, PayoutAccount, PotCard } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

const WINNER_OPTIONS = Array.from({ length: MAX_WINNER_COUNT - MIN_WINNER_COUNT + 1 }, (_, i) => MIN_WINNER_COUNT + i)

// Same split rules the server settles with (@surescore/shared settlement).
function Payouts({ prize, winners, currency }: { prize: number; winners: number; currency: string }) {
  const { winnerPool, platformFee } = splitPrizePool(prize)
  return (
    <ul className="space-y-1 rounded-2xl bg-muted p-3 text-sm">
      <li>
        Platform fee ({PLATFORM_FEE_PERCENT}%): {formatMoney(platformFee, currency)}
      </li>
      <li>
        Winner pool ({WINNER_POOL_PERCENT}%): {formatMoney(winnerPool, currency)}
      </li>
      {DEFAULT_PRIZE_SPLITS[winners]?.map((percent, i) => (
        <li key={i} className="font-semibold">
          Place {i + 1}: {formatMoney((winnerPool * percent) / 100, currency)}
        </li>
      ))}
    </ul>
  )
}

const accountLabel = (a: PayoutAccount) =>
  `${getBankName(a.bankCode) ?? 'Bank account'} · ${a.accountNumber} · ${a.accountName}${a.isDefault ? ' (default)' : ''}`

/** Where refunds go. Required: the potter may have paid by card, which a transfer can't reach. */
function RefundAccountPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const query = useApi<{ payoutAccounts: PayoutAccount[] }>('/api/payout-accounts')
  const [adding, setAdding] = useState(false)
  const accounts = query.data?.payoutAccounts ?? []

  // Preselect the default account once accounts load.
  const preferredId = (accounts.find((a) => a.isDefault) ?? accounts[0])?.id
  useEffect(() => {
    if (!value && preferredId) onChange(preferredId)
  }, [value, preferredId, onChange])

  return (
    <div className="space-y-2 text-sm">
      <span className="block font-semibold">Refund account</span>
      {query.loading ? (
        <p className="text-muted-foreground">Loading your bank accounts…</p>
      ) : query.error ? (
        <ErrorNote error={query.error} onRetry={query.reload} />
      ) : accounts.length > 0 ? (
        <select
          required
          aria-label="Refund account"
          className="h-12 w-full rounded-2xl border border-input bg-transparent px-4"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {accountLabel(a)}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-muted-foreground">Add a bank account to receive any refund for this pot.</p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
        + Add bank account
      </Button>
      <PayoutAccountModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        title="Add refund account"
        onSuccess={(account) => {
          setAdding(false)
          query.reload()
          onChange(account.id)
        }}
      />
    </div>
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
  const [refundAccountId, setRefundAccountId] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
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
          refundAccountId,
          isPrivate,
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Who can join?</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="lg" className="h-12" variant={isPrivate ? 'outline' : 'default'} onClick={() => setIsPrivate(false)}>
                Public
              </Button>
              <Button type="button" size="lg" className="h-12" variant={isPrivate ? 'default' : 'outline'} onClick={() => setIsPrivate(true)}>
                Private
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isPrivate
                ? "Only people you send the link to can see and join. You'll get the link once the pot is funded."
                : 'Listed in Public pots so anyone in your country can join.'}
            </p>
          </fieldset>

          <RefundAccountPicker value={refundAccountId} onChange={setRefundAccountId} />

          <p className="text-xs text-muted-foreground">
            You fund the prize up front. You can cancel until 20 minutes before kickoff; predictions lock 15 minutes before kickoff. If you
            cancel, or the match is postponed or abandoned, the full prize is refunded to your refund account. If nobody predicts, there is
            no winner and you get back the prize less the {PLATFORM_FEE_PERCENT}% platform fee
            {validAmount && currency ? ` (${formatMoney(refundAmountFor(prize, 'no-winner'), currency)})` : ''}.
          </p>

          {error && <ErrorNote error={error} />}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving || !validAmount || !refundAccountId}>
            {saving ? 'Creating…' : 'Create & pay'}
          </Button>
        </form>
      )}
    </Section>
  )
}
