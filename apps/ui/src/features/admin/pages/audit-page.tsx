import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../../../components/bits'
import { queryString } from '../../../lib/api'
import type { AuditEntry } from '../../../lib/types'
import { DataTable, inputClass, usePaged, when } from '../components/kit'

const ACTIONS = [
  'note', 'dispute.open', 'dispute.resolve', 'settlement.override', 'transfer.retry', 'reconciliation.run',
  'reconciliation.resolve', 'staff.create', 'staff.role_change', 'payout_account.create', 'payout_account.update', 'payout_account.delete',
]

export default function Audit() {
  const [action, setAction] = useState('')
  const query = usePaged<AuditEntry>(`/api/admin/audit${queryString({ action })}`)
  return (
    <Section
      title="Audit log"
      action={
        <select className={`${inputClass} w-auto`} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      }
    >
      <DataTable
        query={query}
        empty="No audit entries."
        rowKey={(a) => a.id}
        columns={[
          { header: 'When', cell: (a) => when(a.createdAt) },
          { header: 'Actor', cell: (a) => a.actorEmail ?? a.actorId },
          { header: 'Action', cell: (a) => <b>{a.action}</b> },
          {
            header: 'Target',
            cell: (a) =>
              a.potId ? (
                <Link className="underline" to={`/admin/pots/${a.potId}`}>
                  pot {a.potId.slice(0, 8)}
                </Link>
              ) : (
                <span className="break-all text-xs">{a.subject ?? '—'}</span>
              ),
          },
          { header: 'Reason', className: 'max-w-sm whitespace-normal', cell: (a) => a.reason },
        ]}
      />
    </Section>
  )
}
