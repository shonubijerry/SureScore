import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '../../components/bits'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { Finding, ReconciliationStatus } from '../../lib/types'
import { useApi } from '../../lib/use-api'
import { Can, DataTable, Query, ReasonForm, Row, toneFor, usePaged, when } from './kit'

export default function Reconciliation() {
  const status = useApi<ReconciliationStatus>('/api/admin/reconciliation')
  const findings = usePaged<Finding>('/api/admin/reconciliation/findings')
  const refresh = () => {
    status.reload()
    findings.reload()
  }
  const totals = status.data?.run?.summary as Record<string, Record<string, number>> | undefined

  return (
    <div className="space-y-6">
      <Section title="Daily reconciliation">
        <Query query={status}>
          {(s) => (
            <Row>
              <p>{s.run ? `Last run ${when(s.run.startedAt)}` : 'Never run.'}</p>
              <p>Open: {Object.entries(s.open).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none'}</p>
              {totals &&
                Object.entries(totals).map(([currency, t]) => (
                  <p key={currency} className="text-xs">
                    {currency}: funded {formatMoney(t.fundedMinorUnits, currency)} · paid {formatMoney(t.paidOutMinorUnits, currency)} · refunded{' '}
                    {formatMoney(t.refundedMinorUnits, currency)} · fee {formatMoney(t.platformFeeMinorUnits, currency)} · pending{' '}
                    {formatMoney(t.pendingOutMinorUnits, currency)} · failed {formatMoney(t.failedOutMinorUnits, currency)}
                  </p>
                ))}
              <Can permission="reconciliation.manage">
                <ReasonForm
                  label="Run now"
                  placeholder="Why run it now?"
                  onSubmit={async (reason) => {
                    await api('/api/admin/reconciliation/run', { body: { reason } })
                    refresh()
                  }}
                />
              </Can>
            </Row>
          )}
        </Query>
      </Section>
      <Section title="Open findings">
        <DataTable
          query={findings}
          empty="No open findings."
          rowKey={(f) => f.id}
          columns={[
            { header: 'Severity', cell: (f) => <Badge variant={toneFor(f.severity)}>{f.severity}</Badge> },
            { header: 'Code', cell: (f) => f.code },
            {
              header: 'Detail',
              className: 'max-w-sm whitespace-normal',
              cell: (f) => (
                <>
                  <p>{f.detail}</p>
                  <p className="text-xs text-muted-foreground">{when(f.createdAt)}</p>
                  {f.potId && (
                    <Link className="text-xs underline" to={`/admin/pots/${f.potId}`}>
                      View pot
                    </Link>
                  )}
                </>
              ),
            },
            {
              header: 'Review',
              className: 'min-w-64',
              cell: (f) => (
                <Can permission="reconciliation.manage">
                  <ReasonForm
                    label="Mark reviewed"
                    placeholder="Review note"
                    onSubmit={async (note) => {
                      await api(`/api/admin/reconciliation/findings/${f.id}/resolve`, { body: { note } })
                      refresh()
                    }}
                  />
                </Can>
              ),
            },
          ]}
        />
      </Section>
      <Button variant="outline" size="sm" onClick={refresh}>
        Refresh
      </Button>
    </div>
  )
}
