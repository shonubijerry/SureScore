import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Section } from '../../../components/bits'
import { PotList } from '../components/pot-list'
import { useAuth } from '../../auth/auth-context'
import { queryString } from '../../../lib/api'
import { endOfDayIso, startOfDayIso, toDateInput } from '../../../lib/format'
import type { PotCard as Pot } from '../../../lib/types'
import { usePaged } from '../../../lib/use-paged'

const dayOffset = (days: number) => toDateInput(new Date(Date.now() + days * 86_400_000))

const PRESETS = [
  { label: 'Any date', from: '', to: '' },
  { label: 'Today', from: dayOffset(0), to: dayOffset(0) },
  { label: 'Tomorrow', from: dayOffset(1), to: dayOffset(1) },
  { label: 'Next 7 days', from: dayOffset(0), to: dayOffset(7) },
]

const dateInputClass = 'h-11 w-full min-w-0 rounded-2xl border border-input bg-transparent px-3'

export default function PotsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const setRange = (next: { from: string; to: string }) => setParams(next.from || next.to ? Object.fromEntries(Object.entries(next).filter(([, v]) => v)) : {}, { replace: true })

  const list = usePaged<Pot, 'pots'>(
    `/api/discover/pots${queryString({
      from: from ? startOfDayIso(from) : undefined,
      to: to ? endOfDayIso(to) : undefined,
      countryCode: user?.countryCode,
    })}`,
    'pots',
  )

  return (
    <Section title="Public pots">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant={preset.from === from && preset.to === to ? 'default' : 'outline'}
              onClick={() => setRange(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            From
            <input type="date" className={dateInputClass} value={from} max={to || undefined} onChange={(e) => setRange({ from: e.target.value, to })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            To
            <input type="date" className={dateInputClass} value={to} min={from || undefined} onChange={(e) => setRange({ from, to: e.target.value })} />
          </label>
        </div>
      </div>
      <PotList list={list} empty="No pots match these dates." />
    </Section>
  )
}
