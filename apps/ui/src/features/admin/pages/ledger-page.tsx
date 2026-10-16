import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '../../../components/bits'
import { queryString } from '../../../lib/api'
import { formatMoney } from '../../../lib/format'
import type { LedgerRow } from '../../../lib/types'
import { DataTable, inputClass, toneFor, usePaged, when } from '../components/kit'

export default function Ledger() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({ q: params.get('q') ?? '', type: '', status: '' })
  const [applied, setApplied] = useState(form)
  const query = usePaged<LedgerRow>(`/api/admin/ledger${queryString(applied)}`)
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  return (
    <Section title="Ledger">
      <form
        className="grid gap-2 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(form)
        }}
      >
        <input className={`${inputClass} md:col-span-2`} placeholder="Email, reference, key, pot or user id" value={form.q} onChange={set('q')} />
        <select className={inputClass} value={form.type} onChange={set('type')} aria-label="Type">
          <option value="">Any type</option>
          {['fund', 'payout', 'refund'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className={inputClass} value={form.status} onChange={set('status')} aria-label="Status">
          <option value="">Any status</option>
          {['pending', 'successful', 'failed'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button size="sm">Search</Button>
      </form>
      <DataTable
        query={query}
        empty="No matching entries."
        rowKey={(r) => r.id}
        columns={[
          { header: 'When', cell: (r) => when(r.createdAt) },
          { header: 'Type', cell: (r) => r.type },
          { header: 'Status', cell: (r) => <Badge variant={toneFor(r.status)}>{r.status}</Badge> },
          { header: 'Amount', cell: (r) => formatMoney(r.amountMinorUnits, r.currency) },
          {
            header: 'User',
            cell: (r) => (
              <Link className="underline" to={`/admin/users/${r.userId}`}>
                {r.user?.email ?? r.user?.phone ?? r.userId}
              </Link>
            ),
          },
          {
            header: 'Pot',
            cell: (r) => (
              <Link className="underline" to={`/admin/pots/${r.potId}`}>
                {r.potId.slice(0, 8)}
              </Link>
            ),
          },
          {
            header: 'Reference',
            cell: (r) => (
              <span className="break-all text-xs text-muted-foreground">
                {r.provider} · {r.reference ?? r.idempotencyKey} {r.detail && `· ${r.detail}`}
              </span>
            ),
          },
        ]}
      />
    </Section>
  )
}
