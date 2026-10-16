import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Section } from '../../../components/bits'
import { api, queryString } from '../../../lib/api'
import { formatMoney } from '../../../lib/format'
import type { TransferRow } from '../../../lib/types'
import { Can, DataTable, ReasonForm, inputClass, toneFor, usePaged, when } from '../components/kit'

/** Payout or refund queue; with `userId` (the user page), only that user's transfers. */
export default function Transfers({ type, userId }: { type: 'payouts' | 'refunds'; userId?: string }) {
  const [status, setStatus] = useState('all')
  const query = usePaged<TransferRow>(`/api/admin/${type}${queryString({ status: status === 'all' ? undefined : status, userId })}`)

  return (
    <Section
      title={type === 'payouts' ? 'Payouts' : 'Refunds'}
      action={
        <select className={`${inputClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {['all', 'failed', 'pending', 'successful'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      }
    >
      <DataTable
        query={query}
        empty="Nothing here."
        rowKey={(t) => t.idempotencyKey}
        columns={[
          { header: 'Status', cell: (t) => <Badge variant={toneFor(t.status)}>{t.status}</Badge> },
          { header: 'Amount', cell: (t) => formatMoney(t.amountMinorUnits, t.currency) },
          {
            header: 'User',
            cell: (t) => (
              <Link className="underline" to={`/admin/users/${t.userId}`}>
                {t.displayName ?? t.email ?? t.phone ?? t.userId}
              </Link>
            ),
          },
          {
            header: 'Pot',
            cell: (t) => (
              <Link className="underline" to={`/admin/pots/${t.potId}`}>
                {t.potId.slice(0, 8)}
              </Link>
            ),
          },
          {
            header: 'Attempts',
            cell: (t) => (
              <span className="text-xs text-muted-foreground">
                {t.provider} · {t.attempts}× · {when(t.lastAttemptAt)} {t.detail && `· ${t.detail}`}
              </span>
            ),
          },
          {
            header: 'Action',
            className: 'min-w-64',
            cell: (t) =>
              t.status === 'failed' && (
                <Can permission="transfers.retry">
                  {t.type === 'payout' && (
                    <p className="mb-2 text-xs">
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
                </Can>
              ),
          },
        ]}
      />
    </Section>
  )
}
