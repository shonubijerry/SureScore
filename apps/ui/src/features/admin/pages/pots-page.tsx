import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { potStatuses } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, Section } from '../../../components/bits'
import { api, queryString } from '../../../lib/api'
import { formatMoney } from '../../../lib/format'
import type { AdminPotDetail, AdminPotRow } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'
import { Breakdown } from '../../pots/components/leaderboard'
import { Can, DataTable, Query, ReasonForm, Row, inputClass, toneFor, usePaged, when } from '../components/kit'

const TIE_BREAK_LABEL: Record<string, string> = { underdogBonus: 'Underdog', firstGoalProximity: 'First goal' }

/** The score the pot is ranked on, the prize split, and each winner's pick, points and payout. */
function Winners({ d }: { d: AdminPotDetail }) {
  const money = (minor: number) => formatMoney(minor, d.pot.currency)
  return (
    <Section title="Result & winners">
      <Row>
        {d.result ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black tabular-nums">
              {d.result.homeGoals} – {d.result.awayGoals}
            </span>
            <Badge variant={d.result.final ? 'default' : 'secondary'}>{d.result.final ? 'Final (90 min)' : 'Provisional'}</Badge>
            {d.result.source === 'override' && <Badge variant="destructive">Admin override</Badge>}
            {d.result.firstGoalMinute !== null && <span className="text-xs text-muted-foreground">First goal {d.result.firstGoalMinute}&apos;</span>}
            <span className="text-xs text-muted-foreground">Match status: {d.event.status}</span>
          </div>
        ) : (
          <p className="text-muted-foreground">No score yet. Winners show once the match has a score.</p>
        )}
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Prize</dt>
            <dd className="font-semibold">{money(d.prize.winnerPool + d.prize.platformFee)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Platform fee (10%)</dt>
            <dd className="font-semibold">{money(d.prize.platformFee)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Winner pool · {d.prize.winnerCount} paid</dt>
            <dd className="font-semibold">{money(d.prize.winnerPool)}</dd>
          </div>
        </dl>
      </Row>
      {d.result && d.winners.length === 0 && <Empty>No predictions to rank.</Empty>}
      {d.winners.map((w) => (
        <Row key={w.userId}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-7 text-center text-lg font-black tabular-nums">{w.rank}</span>
            <span className="min-w-0 flex-1">
              <Link className="block truncate font-semibold underline" to={`/admin/users/${w.userId}`}>
                {w.displayName ?? w.email ?? w.phone ?? w.userId}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">{w.email ?? w.phone}</span>
            </span>
            <span className="font-black">{money(w.prizeMinorUnits)}</span>
          </div>
          <p>
            Predicted{' '}
            <b className="tabular-nums">
              {w.prediction.homeGoals} – {w.prediction.awayGoals}
            </b>
            {w.prediction.firstGoalMinute !== null && <span className="text-muted-foreground"> · first goal {w.prediction.firstGoalMinute}&apos;</span>}
            <span className="text-xs text-muted-foreground"> · {when(w.prediction.submittedAt)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <b>{w.breakdown.total} pts</b>
            <Breakdown breakdown={w.breakdown} />
          </div>
          <p className="text-xs text-muted-foreground">
            Tie-breaks:{' '}
            {Object.entries(w.tieBreaks)
              .map(([name, value]) => `${TIE_BREAK_LABEL[name] ?? name} ${value}`)
              .join(' · ')}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {w.payout ? (
              <>
                <Badge variant={toneFor(w.payout.status)}>payout {w.payout.status}</Badge>
                {w.payout.amountMinorUnits !== w.prizeMinorUnits && (
                  <span className="text-destructive">ledger amount {money(w.payout.amountMinorUnits)} differs</span>
                )}
                <span className="break-all text-muted-foreground">
                  {w.payout.reference ?? w.payout.idempotencyKey} · {when(w.payout.lastAttemptAt)} {w.payout.detail && `· ${w.payout.detail}`}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{d.result?.final ? 'No payout yet.' : 'Not settled.'}</span>
            )}
          </div>
        </Row>
      ))}
    </Section>
  )
}

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
              <Winners d={d} />
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
              <Section
                title="Ledger"
                action={
                  <Link className="text-xs underline" to={`/admin/ledger${queryString({ q: d.pot.id })}`}>
                    All entries
                  </Link>
                }
              >
                {d.ledger.length === 0 && <Empty>No ledger entries.</Empty>}
                {d.ledger.map((r) => (
                  <Row key={r.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={toneFor(r.status)}>{r.status}</Badge>
                      <b>{r.type}</b> {formatMoney(r.amountMinorUnits, r.currency)}
                      <Link className="text-muted-foreground underline" to={`/admin/users/${r.userId}`}>
                        {r.user?.email ?? r.user?.phone ?? r.userId}
                      </Link>
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
