import { Badge } from '@/components/ui/badge'
import { Empty, Section } from '../../../components/bits'
import { formatMoney } from '../../../lib/format'
import type { ProviderHealth } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'
import { Query, Row, toneFor, when } from '../components/kit'

interface Alert {
  kind: string
  severity: 'warning' | 'critical'
  key: string
  message: string
}

export default function Dashboard() {
  const alerts = useApi<{ alerts: Alert[] }>('/api/admin/alerts', 60_000)
  const pots = useApi<{ states: { status: string; currency: string; count: number; prizeMinorUnits: number }[] }>('/api/admin/pots/summary')
  const health = useApi<ProviderHealth>('/api/admin/health', 60_000)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
      <Section title="Active alerts">
        <Query query={alerts}>
          {({ alerts: list }) =>
            list.length === 0 ? (
              <Empty>All systems healthy.</Empty>
            ) : (
              list.map((a) => (
                <Row key={a.key}>
                  <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'}>{a.severity}</Badge> {a.message}
                </Row>
              ))
            )
          }
        </Query>
      </Section>
      <Section title="Pots by state">
        <Query query={pots}>
          {({ states }) => (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {states.map((r) => (
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Payment providers (24h)">
              {h.payments.map((p) => (
                <Row key={p.provider}>
                  <p className="font-semibold">{p.provider}</p>
                  <p>
                    {p.successful24h} ok · {p.pending24h} pending · {p.failed24h} failed ({Math.round(p.failureRate * 100)}%)
                  </p>
                  {p.lastFailureDetail && (
                    <p className="text-xs text-destructive">
                      {when(p.lastFailureAt)}: {p.lastFailureDetail}
                    </p>
                  )}
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
            </Section>
            <Section title="Recent job failures">
              {h.recentFailures.length === 0 && <Empty>No failures.</Empty>}
              {h.recentFailures.slice(0, 10).map((f) => (
                <Row key={f.id}>
                  <p className="text-destructive">
                    {f.job} · {when(f.startedAt)}
                  </p>
                  <p className="text-xs">{f.error}</p>
                </Row>
              ))}
            </Section>
          </div>
        )}
      </Query>
    </div>
  )
}
