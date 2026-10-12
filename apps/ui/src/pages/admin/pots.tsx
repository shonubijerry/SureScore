import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { potStatuses } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, Section } from '../../components/bits'
import { api, queryString } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { AdminPotDetail, AdminPotRow } from '../../lib/types'
import { useApi } from '../../lib/use-api'
import { Can, DataTable, Query, ReasonForm, Row, inputClass, toneFor, usePaged, when } from './kit'

export function PotList() {
  const [status, setStatus] = useState('')
  const query = usePaged<AdminPotRow>(`/api/admin/pots${queryString({ status })}`)
  return (
    <Section
      title="Pots"
      action={
        <select className={`${inputClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="State">
          <option value="">All states</option>
          {potStatuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      }
    >
      <DataTable
        query={query}
        empty="No pots."
        rowKey={(p) => p.id}
        columns={[
          {
            header: 'Match',
            cell: (p) => (
              <Link className="font-semibold underline" to={`/admin/pots/${p.id}`}>
                {p.event.homeTeam} v {p.event.awayTeam}
              </Link>
            ),
          },
          { header: 'State', cell: (p) => <Badge variant={toneFor(p.status)}>{p.status}</Badge> },
          { header: 'Prize', cell: (p) => formatMoney(p.prizeAmountMinorUnits, p.currency) },
          { header: 'Kickoff', cell: (p) => when(p.event.kickoffTimeUtc) },
        ]}
      />
    </Section>
  )
}

export function PotDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useApi<AdminPotDetail>(`/api/admin/pots/${id}`)
  const [home, setHome] = useState('0')
  const [away, setAway] = useState('0')
  const post = (path: string, body: unknown) => async () => {
    await api(`/api/admin/pots/${id}/${path}`, { body })
    query.reload()
  }

  return (
    <Section title="Pot detail" action={<Button variant="outline" size="sm" onClick={() => navigate('/admin/pots')}>Back</Button>}>
      <Query query={query}>
        {(d) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Row>
                <p className="font-semibold">
                  {d.event.homeTeam} v {d.event.awayTeam}
                </p>
                <p>
                  <Badge variant={toneFor(d.pot.status)}>{d.pot.status}</Badge> {formatMoney(d.pot.prizeAmountMinorUnits, d.pot.currency)} · {d.predictionCount} predictions
                </p>
                {d.override && (
                  <p className="text-xs">
                    Override {d.override.homeGoals}-{d.override.awayGoals}: {d.override.reason}
                  </p>
                )}
              </Row>
              <Row>
                <p className="font-semibold">Actions</p>
                <Can permission="pots.annotate">
                  <ReasonForm label="Add note" placeholder="Note" onSubmit={(note) => post('notes', { note })()} />
                </Can>
                <Can permission="pots.dispute">
                  {(d.pot.status === 'Settling' || d.pot.status === 'Paid') && (
                    <ReasonForm label="Open dispute" onSubmit={(reason) => post('dispute', { reason })()} />
                  )}
                  {d.pot.status === 'Disputed' && (
                    <ReasonForm label="Resolve dispute" placeholder="Resolution note" onSubmit={(reason) => post('dispute/resolve', { reason })()} />
                  )}
                </Can>
                <Can permission="pots.override">
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
                </Can>
              </Row>
              <Section title="Audit notes">
                {d.notes.length === 0 && <Empty>No notes.</Empty>}
                {d.notes.map((n) => (
                  <Row key={n.id}>
                    <p>
                      <b>{n.action}</b> · {when(n.createdAt)}
                    </p>
                    <p>{n.reason}</p>
                  </Row>
                ))}
              </Section>
            </div>
            <div className="space-y-4">
              <Section title="State history">
                {d.transitions.map((t) => (
                  <p key={t.id} className="text-xs">
                    {when(t.createdAt)} · {t.fromStatus ?? '∅'} → {t.toStatus} {t.reason && `· ${t.reason}`}
                  </p>
                ))}
              </Section>
              <Section title="Ledger">
                {d.ledger.length === 0 && <Empty>No ledger entries.</Empty>}
                {d.ledger.map((r) => (
                  <Row key={r.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={toneFor(r.status)}>{r.status}</Badge>
                      <b>{r.type}</b> {formatMoney(r.amountMinorUnits, r.currency)}
                      <span className="text-muted-foreground">{r.user?.email ?? r.userId}</span>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      {r.provider} · {r.reference ?? r.idempotencyKey} · {when(r.createdAt)} {r.detail && `· ${r.detail}`}
                    </p>
                  </Row>
                ))}
              </Section>
            </div>
          </div>
        )}
      </Query>
    </Section>
  )
}
