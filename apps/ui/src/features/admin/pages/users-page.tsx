import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { roles } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, Section } from '../../../components/bits'
import { queryString } from '../../../lib/api'
import { formatMoney } from '../../../lib/format'
import type { AdminUserDetail, StaffUser } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'
import { Can, DataTable, Query, Row, inputClass, toneFor, usePaged, when } from '../components/kit'
import Transfers from './transfers-page'

export function UserList() {
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [role, setRole] = useState('')
  const query = usePaged<StaffUser>(`/api/admin/users${queryString({ q: applied, role })}`)

  return (
    <Section
      title="Users"
      action={
        <select className={`${inputClass} w-auto`} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(q.trim())
        }}
      >
        <input className={inputClass} placeholder="Search phone, email, name or user id" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm">Search</Button>
      </form>
      <DataTable
        query={query}
        empty="No users found."
        rowKey={(u) => u.id}
        columns={[
          {
            header: 'Name',
            cell: (u) => (
              <Link className="font-semibold underline" to={`/admin/users/${u.id}`}>
                {u.displayName ?? u.email ?? u.phone ?? u.id}
              </Link>
            ),
          },
          { header: 'Email', cell: (u) => u.email ?? '—' },
          { header: 'Phone', cell: (u) => u.phone ?? '—' },
          { header: 'Country', cell: (u) => u.countryCode },
          { header: 'Role', cell: (u) => <Badge variant={toneFor(u.role)}>{u.role}</Badge> },
          { header: 'Joined', cell: (u) => when(u.createdAt) },
        ]}
      />
    </Section>
  )
}

export function UserDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useApi<AdminUserDetail>(`/api/admin/users/${id}`)

  return (
    <div className="space-y-6">
      <Section title="User" action={<Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>Back</Button>}>
        <Query query={query}>
          {(d) => (
            <div className="grid gap-4 lg:grid-cols-2">
              <Row>
                <p className="font-semibold">{d.user.displayName ?? '—'}</p>
                <p>
                  {d.user.email ?? '—'} {d.user.emailVerifiedAt && <Badge variant="outline">verified</Badge>}
                </p>
                <p>{d.user.phone ?? '—'}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={toneFor(d.user.role)}>{d.user.role}</Badge> {d.user.countryCode} · joined {when(d.user.createdAt)}
                </p>
                <p className="break-all text-xs text-muted-foreground">{d.user.id}</p>
                <p className="text-xs">
                  {d.stats.potsCreated} pots created · {d.stats.predictions} predictions
                </p>
                <Can permission="ledger.view">
                  <Link className="text-xs underline" to={`/admin/ledger${queryString({ q: d.user.id })}`}>
                    Ledger entries
                  </Link>
                </Can>
              </Row>
              <div className="space-y-4">
                <Row>
                  <p className="font-semibold">Settled totals</p>
                  {d.totals.length === 0 && <p className="text-muted-foreground">No settled money movement.</p>}
                  {d.totals.map((t) => (
                    <p key={`${t.type}:${t.currency}`}>
                      <span className="capitalize">{t.type}</span>: <b>{formatMoney(t.amountMinorUnits, t.currency)}</b>
                    </p>
                  ))}
                </Row>
                <Section title="Payout accounts">
                  {d.payoutAccounts.length === 0 && <Empty>No payout accounts.</Empty>}
                  {d.payoutAccounts.map((a) => (
                    <Row key={a.id}>
                      <p className="flex flex-wrap items-center gap-2">
                        <b>{a.accountName}</b> {a.accountNumber}
                        {a.isDefault && <Badge>default</Badge>}
                        {a.isVerified && <Badge variant="outline">verified</Badge>}
                        {a.deletedAt && <Badge variant="destructive">deleted</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.provider} · {a.countryCode} {a.bankCode && `· bank ${a.bankCode}`} · updated {when(a.updatedAt)}
                      </p>
                    </Row>
                  ))}
                </Section>
              </div>
            </div>
          )}
        </Query>
      </Section>
      <Can permission="transfers.view">
        <Transfers type="payouts" userId={id} />
        <Transfers type="refunds" userId={id} />
      </Can>
    </div>
  )
}
