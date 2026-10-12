import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { potStatuses } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, ErrorNote, Loading, Section } from '../components/bits'
import { api, queryString } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatKickoff, formatMoney } from '../lib/format'
import type {
  AdminPotDetail,
  AdminPotRow,
  Finding,
  LedgerRow,
  Page,
  ProviderHealth,
  ReconciliationStatus,
  TransferRow,
} from '../lib/types'
import { useApi } from '../lib/use-api'

const TABS = ['Overview', 'Payouts', 'Refunds', 'Pots', 'Ledger', 'Reconciliation'] as const
type Tab = (typeof TABS)[number]

const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm'
const when = (iso: string | null) => (iso ? formatKickoff(iso) : '—')
const toneFor = (s: string) =>
  ['failed', 'critical', 'high', 'Disputed'].includes(s) ? 'destructive' : s === 'pending' ? 'secondary' : 'outline'

/** Reasons are mandatory for every admin action, so every action shares this form. */
function ReasonForm({
  label,
  placeholder = 'Reason (min 5 characters)',
  onSubmit,
  children,
}: {
  label: string
  placeholder?: string
  onSubmit: (reason: string) => Promise<unknown>
  children?: ReactNode
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(reason.trim())
      setReason('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {children}
      <input className={inputClass} value={reason} minLength={5} required placeholder={placeholder} onChange={(e) => setReason(e.target.value)} />
      <Button size="sm" disabled={busy || reason.trim().length < 5}>
        {busy ? 'Working…' : label}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="space-y-2 rounded-2xl border border-border p-3 text-sm">{children}</div>
)

function Query<T>({ query, children }: { query: { data: T | null; error: Error | null; loading: boolean; reload: () => void }; children: (d: T) => ReactNode }) {
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote error={query.error} onRetry={query.reload} />
  return query.data ? <>{children(query.data)}</> : null
}

/** Cursor-paged list that accumulates pages behind a "Load more" button. */
function usePaged<T>(path: string) {
  const first = useApi<Page<T>>(path)
  const [extra, setExtra] = useState<{ items: T[]; next: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const next = extra ? extra.next : (first.data?.nextCursor ?? null)
  const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])]

  async function more() {
    if (!next) return
    setBusy(true)
    try {
      const page = await api<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(next)}`)
      setExtra({ items: [...(extra?.items ?? []), ...page.items], next: page.nextCursor })
    } finally {
      setBusy(false)
    }
  }
  return { ...first, items, hasMore: !!next, more, busy }
}

function Paged<T>({ query, empty, render }: { query: ReturnType<typeof usePaged<T>>; empty: string; render: (item: T) => ReactNode }) {
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote error={query.error} onRetry={query.reload} />
  if (!query.items.length) return <Empty>{empty}</Empty>
  return (
    <div className="space-y-3">
      {query.items.map(render)}
      {query.hasMore && (
        <Button variant="outline" size="sm" onClick={query.more} disabled={query.busy}>
          {query.busy ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}

function Overview() {
  const pots = useApi<{ states: { status: string; currency: string; count: number; prizeMinorUnits: number }[] }>('/api/admin/pots/summary')
  const health = useApi<ProviderHealth>('/api/admin/health', 60_000)
  return (
    <div className="space-y-8">
      <Section title="Pots by state">
        <Query query={pots}>
          {({ states: rows }) => (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {rows.map((r) => (
                <Row key={r.status + r.currency}>
                  <Badge variant={toneFor(r.status)}>{r.status}</Badge>
                  <p className="text-xl font-bold">{r.count}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(r.prizeMinorUnits, r.currency)}</p>
                </Row>
              ))}
            </div>
          )}
        </Query>
      </Section>
      <Query query={health}>
        {(h) => (
          <>
            <Section title="Payment providers (24h)">
              {h.payments.map((p) => (
                <Row key={p.provider}>
                  <p className="font-semibold">{p.provider}</p>
                  <p>
                    {p.successful24h} ok · {p.pending24h} pending · {p.failed24h} failed ({Math.round(p.failureRate * 100)}%)
                  </p>
                  {p.lastFailureDetail && <p className="text-xs text-destructive">{when(p.lastFailureAt)}: {p.lastFailureDetail}</p>}
                </Row>
              ))}
            </Section>
            <Section title="Sports providers">
              {h.sports.map((s) => (
                <Row key={s.provider}>
                  <p className="font-semibold">{s.provider}</p>
                  <p>
                    {s.events} events · {s.stale} stale · {s.failedJobs24h} failed jobs · refreshed {when(s.lastRefreshedAt)}
                  </p>
                </Row>
              ))}
            </Section>
            <Section title="Scheduled jobs (24h)">
              {h.jobs.length === 0 && <Empty>No job runs recorded yet.</Empty>}
              {h.jobs.map((j) => (
                <Row key={j.job}>
                  <p className="font-semibold">{j.job}</p>
                  <p>
                    {j.runs24h} runs · <span className={j.failures24h ? 'text-destructive' : ''}>{j.failures24h} failed</span> · last {when(j.lastRunAt)}
                  </p>
                </Row>
              ))}
              {h.recentFailures.map((f) => (
                <Row key={f.id}>
                  <p className="text-destructive">{f.job} · {when(f.startedAt)}</p>
                  <p className="text-xs">{f.error}</p>
                </Row>
              ))}
            </Section>
          </>
        )}
      </Query>
    </div>
  )
}

function TransferQueue({ type }: { type: 'payouts' | 'refunds' }) {
  const [status, setStatus] = useState(type === 'payouts' ? 'failed' : 'pending')
  const query = usePaged<TransferRow>(`/api/admin/${type}${queryString({ status })}`)
  return (
    <Section
      title={type === 'payouts' ? 'Payout queue' : 'Refund queue'}
      action={
        <select className="rounded-xl border border-border bg-background px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {['failed', 'pending', 'successful'].map((s) => <option key={s}>{s}</option>)}
        </select>
      }
    >
      <Paged
        query={query}
        empty="Nothing here."
        render={(t) => (
          <Row key={t.idempotencyKey}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={toneFor(t.status)}>{t.status}</Badge>
              <span className="font-semibold">{formatMoney(t.amountMinorUnits, t.currency)}</span>
              <span className="text-muted-foreground">{t.email ?? '—'}</span>
              <Link className="text-xs underline" to={`/admin?pot=${t.potId}`}>pot {t.potId.slice(0, 8)}</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.provider} · {t.attempts} attempt(s) · {when(t.lastAttemptAt)} {t.detail && `· ${t.detail}`}
            </p>
            {t.status === 'failed' && (
              <>
                {t.type === 'payout' && (
                  <p className="text-xs">
                    {!t.hasPayoutAccount ? 'User has no payout account.' : t.readyToRetry ? 'Payout details updated — ready to retry.' : 'Waiting for the user to update payout details.'}
                  </p>
                )}
                <ReasonForm
                  label="Retry"
                  onSubmit={async (reason) => {
                    await api('/api/admin/transfers/retry', { body: { idempotencyKey: t.idempotencyKey, reason } })
                    query.reload()
                  }}
                />
              </>
            )}
          </Row>
        )}
      />
    </Section>
  )
}

function PotDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useApi<AdminPotDetail>(`/api/admin/pots/${id}`)
  const [home, setHome] = useState('0')
  const [away, setAway] = useState('0')
  const post = (path: string, body: unknown) => async () => {
    await api(`/api/admin/pots/${id}/${path}`, { body })
    query.reload()
  }
  return (
    <Section title="Pot detail" action={<Button variant="outline" size="sm" onClick={onBack}>Back</Button>}>
      <Query query={query}>
        {(d) => (
          <div className="space-y-4">
            <Row>
              <p className="font-semibold">{d.event.homeTeam} v {d.event.awayTeam}</p>
              <p>
                <Badge variant={toneFor(d.pot.status)}>{d.pot.status}</Badge> {formatMoney(d.pot.prizeAmountMinorUnits, d.pot.currency)} · {d.predictionCount} predictions
              </p>
              {d.override && <p className="text-xs">Override {d.override.homeGoals}-{d.override.awayGoals}: {d.override.reason}</p>}
            </Row>
            <Row>
              <p className="font-semibold">Actions</p>
              <ReasonForm label="Add note" onSubmit={(note) => post('notes', { note })()} />
              {(d.pot.status === 'Settling' || d.pot.status === 'Paid') && (
                <ReasonForm label="Open dispute" onSubmit={(reason) => post('dispute', { reason })()} />
              )}
              {d.pot.status === 'Disputed' && (
                <ReasonForm label="Resolve dispute" placeholder="Resolution note" onSubmit={(reason) => post('dispute/resolve', { reason })()} />
              )}
              {['Live', 'Settling', 'Disputed'].includes(d.pot.status) && !d.override && (
                <ReasonForm
                  label="Override settlement"
                  placeholder="Reason for manual score (regulation time)"
                  onSubmit={(reason) => post('settlement-override', { homeGoals: Number(home), awayGoals: Number(away), reason })()}
                >
                  <div className="flex gap-2">
                    <input className={inputClass} type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)} aria-label="Home goals" />
                    <input className={inputClass} type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)} aria-label="Away goals" />
                  </div>
                </ReasonForm>
              )}
            </Row>
            <Section title="Audit notes">
              {d.notes.length === 0 && <Empty>No notes.</Empty>}
              {d.notes.map((n) => <Row key={n.id}><p><b>{n.action}</b> · {when(n.createdAt)}</p><p>{n.reason}</p></Row>)}
            </Section>
            <Section title="State history">
              {d.transitions.map((t) => (
                <p key={t.id} className="text-xs">{when(t.createdAt)} · {t.fromStatus ?? '∅'} → {t.toStatus} {t.reason && `· ${t.reason}`}</p>
              ))}
            </Section>
            <Section title="Ledger"><LedgerRows rows={d.ledger} /></Section>
          </div>
        )}
      </Query>
    </Section>
  )
}

const LedgerRows = ({ rows }: { rows: LedgerRow[] }) => (
  <div className="space-y-2">
    {rows.map((r) => (
      <Row key={r.id}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={toneFor(r.status)}>{r.status}</Badge>
          <b>{r.type}</b> {formatMoney(r.amountMinorUnits, r.currency)}
          <span className="text-muted-foreground">{r.user?.email ?? r.userId}</span>
        </div>
        <p className="break-all text-xs text-muted-foreground">{r.provider} · {r.reference ?? r.idempotencyKey} · {when(r.createdAt)} {r.detail && `· ${r.detail}`}</p>
      </Row>
    ))}
  </div>
)

function Pots({ initialId }: { initialId: string | null }) {
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(initialId)
  const query = usePaged<AdminPotRow>(`/api/admin/pots${queryString({ status })}`)
  if (selected) return <PotDetail id={selected} onBack={() => setSelected(null)} />
  return (
    <Section
      title="Pots"
      action={
        <select className="rounded-xl border border-border bg-background px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All states</option>
          {potStatuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      }
    >
      <Paged
        query={query}
        empty="No pots."
        render={(p) => (
          <button key={p.id} className="block w-full text-left" onClick={() => setSelected(p.id)}>
            <Row>
              <p className="font-semibold">{p.event.homeTeam} v {p.event.awayTeam}</p>
              <p><Badge variant={toneFor(p.status)}>{p.status}</Badge> {formatMoney(p.prizeAmountMinorUnits, p.currency)} · {when(p.event.kickoffTimeUtc)}</p>
            </Row>
          </button>
        )}
      />
    </Section>
  )
}

function Ledger() {
  const [form, setForm] = useState({ q: '', type: '', status: '' })
  const [applied, setApplied] = useState(form)
  const query = usePaged<LedgerRow>(`/api/admin/ledger${queryString(applied)}`)
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })
  return (
    <Section title="Ledger search">
      <form
        className="grid gap-2 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(form)
        }}
      >
        <input className={`${inputClass} md:col-span-2`} placeholder="Email, reference, key, pot or user id" value={form.q} onChange={set('q')} />
        <select className={inputClass} value={form.type} onChange={set('type')}>
          <option value="">Any type</option>
          {['fund', 'payout', 'refund'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={inputClass} value={form.status} onChange={set('status')}>
          <option value="">Any status</option>
          {['pending', 'successful', 'failed'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <Button size="sm">Search</Button>
      </form>
      <Paged query={query} empty="No matching entries." render={(r) => <LedgerRows key={r.id} rows={[r]} />} />
    </Section>
  )
}

function Reconciliation() {
  const status = useApi<ReconciliationStatus>('/api/admin/reconciliation')
  const findings = usePaged<Finding>('/api/admin/reconciliation/findings')
  const refresh = () => {
    status.reload()
    findings.reload()
  }
  const totals = status.data?.run?.summary as Record<string, Record<string, number>> | undefined
  return (
    <div className="space-y-6">
      <Section
        title="Daily reconciliation"
        action={
          <Button size="sm" onClick={async () => { await api('/api/admin/reconciliation/run', { body: {} }); refresh() }}>
            Run now
          </Button>
        }
      >
        <Query query={status}>
          {(s) => (
            <Row>
              <p>{s.run ? `Last run ${when(s.run.startedAt)}` : 'Never run.'}</p>
              <p>
                Open: {Object.entries(s.open).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none'}
              </p>
              {totals && Object.entries(totals).map(([currency, t]) => (
                <p key={currency} className="text-xs">
                  {currency}: funded {formatMoney(t.fundedMinorUnits, currency)} · paid {formatMoney(t.paidOutMinorUnits, currency)} · refunded {formatMoney(t.refundedMinorUnits, currency)} · fee {formatMoney(t.platformFeeMinorUnits, currency)} · pending {formatMoney(t.pendingOutMinorUnits, currency)} · failed {formatMoney(t.failedOutMinorUnits, currency)}
                </p>
              ))}
            </Row>
          )}
        </Query>
      </Section>
      <Section title="Open findings">
        <Paged
          query={findings}
          empty="No open findings."
          render={(f) => (
            <Row key={f.id}>
              <p><Badge variant={toneFor(f.severity)}>{f.severity}</Badge> <b>{f.code}</b> · {when(f.createdAt)}</p>
              <p>{f.detail}</p>
              {f.potId && <Link className="text-xs underline" to={`/admin?pot=${f.potId}`}>View pot</Link>}
              <ReasonForm
                label="Mark reviewed"
                placeholder="Review note"
                onSubmit={async (note) => {
                  await api(`/api/admin/reconciliation/findings/${f.id}/resolve`, { body: { note } })
                  refresh()
                }}
              />
            </Row>
          )}
        />
      </Section>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const initialPot = new URLSearchParams(window.location.search).get('pot')
  const [tab, setTab] = useState<Tab>(initialPot ? 'Pots' : 'Overview')
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Admin</h1>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={t === tab ? 'default' : 'outline'} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Payouts' && <TransferQueue type="payouts" />}
      {tab === 'Refunds' && <TransferQueue type="refunds" />}
      {tab === 'Pots' && <Pots initialId={initialPot} />}
      {tab === 'Ledger' && <Ledger />}
      {tab === 'Reconciliation' && <Reconciliation />}
    </div>
  )
}
