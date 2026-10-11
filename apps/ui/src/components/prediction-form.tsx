import { useState, type FormEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_FIRST_GOAL_MINUTE, MAX_PREDICTED_GOALS } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { api } from '../lib/api'
import type { Match, PredictionPick, PredictionView } from '../lib/types'
import { ErrorNote } from './bits'

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
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
          className="h-12 w-14 rounded-2xl border border-input bg-transparent text-center text-2xl font-black tabular-nums"
        />
        <Button type="button" variant="outline" size="icon-lg" aria-label={`More ${label} goals`} onClick={() => onChange(clamp(value + 1))}>
          <Plus />
        </Button>
      </div>
    </div>
  )
}

/** Submit (POST) or edit (PUT) the user's single prediction for a pot. */
export function PredictionForm({
  potId,
  match,
  existing,
  onSaved,
}: {
  potId: string
  match: Match
  existing: PredictionPick | null
  onSaved: (view: PredictionView) => void
}) {
  const [home, setHome] = useState(existing?.homeGoals ?? 0)
  const [away, setAway] = useState(existing?.awayGoals ?? 0)
  const [minute, setMinute] = useState(existing?.firstGoalMinute?.toString() ?? '')
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)
  const noGoals = home + away === 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const firstGoalMinute = noGoals || !minute ? null : Number(minute)
      const view = await api<PredictionView>(`/api/pots/${potId}/predictions`, {
        method: existing ? 'PUT' : 'POST',
        body: { homeGoals: home, awayGoals: away, firstGoalMinute },
      })
      onSaved(view)
    } catch (e) {
      setError(e as Error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Predict the score after 90 minutes. Extra time and penalties don't count.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stepper label={match.homeTeam} value={home} onChange={setHome} />
        <Stepper label={match.awayTeam} value={away} onChange={setAway} />
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Minute of first goal (optional tie-break)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_FIRST_GOAL_MINUTE}
          disabled={noGoals}
          value={noGoals ? '' : minute}
          onChange={(e) => setMinute(e.target.value)}
          className="h-12 w-full rounded-2xl border border-input bg-transparent px-4 disabled:opacity-50"
        />
      </label>
      {error && <ErrorNote error={error} />}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving}>
        {saving ? 'Saving…' : existing ? 'Update prediction' : 'Lock in prediction'}
      </Button>
    </form>
  )
}
