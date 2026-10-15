import { useState, type FormEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_FIRST_GOAL_MINUTE, MAX_PREDICTED_GOALS } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { api } from '../../../lib/api'
import type { Match, PayoutAccount, PredictionPick, PredictionView } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'
import { ErrorNote } from '../../../components/bits'
import { InfoTip } from '../../../components/info-tip'
import { PayoutAccountModal } from '../../account/components/payout-account-modal'

export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const clamp = (n: number) => Math.min(MAX_PREDICTED_GOALS, Math.max(0, n))
  return (
    <div className="space-y-1 text-center">
      <span className="block truncate text-sm font-semibold">{label}</span>
      <div className="flex items-center justify-center gap-2">
        <Button type="button" variant="outline" size="icon-lg" aria-label={`Fewer ${label} goals`} onClick={() => onChange(clamp(value - 1))}>
          <Minus />
        </Button>
        <input
          aria-label={`${label} goals`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_PREDICTED_GOALS}
          value={value}
          onChange={(e) => onChange(clamp(Math.trunc(Number(e.target.value)) || 0))}
          className="h-12 w-14 rounded-2xl border border-input bg-transparent text-center text-2xl font-black tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Button type="button" variant="outline" size="icon-lg" aria-label={`More ${label} goals`} onClick={() => onChange(clamp(value + 1))}>
          <Plus />
        </Button>
      </div>
    </div>
  )
}

/** Submit (POST) or edit (PUT) the user's single prediction for a pot. `shareCode` admits the user to a private pot. */
export function PredictionForm({
  potId,
  match,
  existing,
  shareCode,
  onSaved,
}: {
  potId: string
  match: Match
  existing: PredictionPick | null
  shareCode?: string
  onSaved: (view: PredictionView) => void
}) {
  const [home, setHome] = useState(existing?.homeGoals ?? 0)
  const [away, setAway] = useState(existing?.awayGoals ?? 0)
  const [minute, setMinute] = useState(existing?.firstGoalMinute?.toString() ?? '')
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [pendingPick, setPendingPick] = useState<PredictionPick | null>(null)

  const accountsQuery = useApi<{ payoutAccounts: PayoutAccount[] }>('/api/payout-accounts')

  async function executeSave(pick: PredictionPick) {
    setSaving(true)
    setError(null)
    try {
      const view = await api<PredictionView>(`/api/pots/${potId}/predictions`, {
        method: existing ? 'PUT' : 'POST',
        body: existing || !shareCode ? pick : { ...pick, shareCode },
      })
      onSaved(view)
    } catch (e) {
      const err = e as Error
      if (err.message && /payout/i.test(err.message)) {
        setPendingPick(pick)
        setShowPayoutModal(true)
        return
      }
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const firstGoalMinute = minute ? Number(minute) : null
    const pick: PredictionPick = { homeGoals: home, awayGoals: away, firstGoalMinute }

    // If user has no active payout account yet, prompt them with the modal first
    const accounts = accountsQuery.data?.payoutAccounts ?? []
    if (!existing && !accountsQuery.loading && accounts.length === 0) {
      setPendingPick(pick)
      setShowPayoutModal(true)
      return
    }

    await executeSave(pick)
  }

  function handlePayoutCreated() {
    accountsQuery.reload()
    if (pendingPick) {
      const pickToSave = pendingPick
      setPendingPick(null)
      executeSave(pickToSave)
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">Predict the score after 90 minutes. Extra time and penalties don't count.</p>
        <div className="grid grid-cols-2 gap-3">
          <Stepper label={match.homeTeam} value={home} onChange={setHome} />
          <Stepper label={match.awayTeam} value={away} onChange={setAway} />
        </div>
        <div className="space-y-1 text-sm">
          <span className="flex items-center justify-center gap-1">
            <label htmlFor={`first-goal-${potId}`} className="font-semibold">
              Minute of first goal (optional)
            </label>
            <InfoTip label="What is the first-goal minute?">
              The minute (1–{MAX_FIRST_GOAL_MINUTE}) you expect the first goal of the match. It is only used as a tie-breaker: if two
              players have equal points, the one whose minute is closest to the real first goal ranks higher. Leave it blank to skip,
              or for a 0–0 pick it simply won't count unless a goal is scored.
            </InfoTip>
          </span>
          <input
            id={`first-goal-${potId}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_FIRST_GOAL_MINUTE}
            placeholder="e.g. 23"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            className="mx-auto block h-12 w-28 rounded-2xl border border-input bg-transparent text-center text-xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        {error && <ErrorNote error={error} />}
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Update prediction' : 'Lock in prediction'}
        </Button>
      </form>

      <PayoutAccountModal
        isOpen={showPayoutModal}
        onClose={() => {
          setShowPayoutModal(false)
          setPendingPick(null)
        }}
        onSuccess={handlePayoutCreated}
        title="Add Payout Account to Predict"
        subtitle="You need an active bank account to receive your winnings if your prediction wins."
      />
    </>
  )
}
