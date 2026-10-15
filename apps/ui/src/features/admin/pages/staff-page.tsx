import { useState } from 'react'
import { roles, staffRoles } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '../../../components/bits'
import { api, queryString } from '../../../lib/api'
import { useAuth } from '../../auth/auth-context'
import type { StaffUser } from '../../../lib/types'
import { Can, DataTable, ReasonForm, Row, inputClass, toneFor, usePaged, when } from '../components/kit'

export default function Staff() {
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<(typeof staffRoles)[number]>('staff')
  const [newRole, setNewRole] = useState<Record<string, string>>({})
  const query = usePaged<StaffUser>(`/api/admin/staff${queryString({ q: applied })}`)

  return (
    <div className="space-y-6">
      <Can permission="staff.manage">
        <Section title="Add staff or admin">
          <Row>
            <p className="text-xs text-muted-foreground">Enter an existing user&apos;s email to promote them; otherwise a full name and password create a new account that signs in with that email.</p>
            <ReasonForm
              label="Save"
              placeholder="Reason (audited)"
              onSubmit={async (reason) => {
                await api('/api/admin/staff', {
                  body: { email, role, reason, ...(password && { password }), ...(fullName.trim() && { displayName: fullName.trim() }) },
                })
                setEmail('')
                setFullName('')
                setPassword('')
                query.reload()
              }}
            >
              <input className={inputClass} type="email" required placeholder="Email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="grid gap-2 md:grid-cols-3">
                <input className={inputClass} placeholder="Full name (new accounts)" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input className={inputClass} type="password" minLength={8} placeholder="Password (new accounts)" value={password} onChange={(e) => setPassword(e.target.value)} />
                <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
                  {staffRoles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </ReasonForm>
          </Row>
        </Section>
      </Can>
      <Section title="Team">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setApplied(q)
          }}
        >
          <input className={inputClass} placeholder="Search phone, email or name" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm">Search</Button>
        </form>
        <DataTable
          query={query}
          empty="No staff found."
          rowKey={(u) => u.id}
          columns={[
            { header: 'Email', cell: (u) => u.email ?? '—' },
            { header: 'Phone', cell: (u) => u.phone ?? '—' },
            { header: 'Name', cell: (u) => u.displayName ?? '—' },
            { header: 'Role', cell: (u) => <Badge variant={toneFor(u.role)}>{u.role}</Badge> },
            { header: 'Joined', cell: (u) => when(u.createdAt) },
            {
              header: 'Change role',
              className: 'min-w-64',
              cell: (u) =>
                u.id !== me?.id && (
                  <Can permission="staff.manage">
                    <ReasonForm
                      label="Update"
                      onSubmit={async (reason) => {
                        await api(`/api/admin/staff/${u.id}`, { method: 'PATCH', body: { role: newRole[u.id] ?? u.role, reason } })
                        query.reload()
                      }}
                    >
                      <select
                        className={inputClass}
                        value={newRole[u.id] ?? u.role}
                        onChange={(e) => setNewRole({ ...newRole, [u.id]: e.target.value })}
                        aria-label={`Role for ${u.email ?? u.displayName}`}
                      >
                        {roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </ReasonForm>
                  </Can>
                ),
            },
          ]}
        />
      </Section>
    </div>
  )
}
