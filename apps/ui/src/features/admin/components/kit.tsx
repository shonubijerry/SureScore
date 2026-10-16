// Shared building blocks for the admin console: formatting, permission gate
// and a paginated table. Every list is fetched through the app-wide `usePaged`
// (1000 rows per request, "Load more" by keyset cursor) and shown through
// `DataTable` (50 rows per page).

import { useState, type FormEvent, type ReactNode } from 'react'
import { hasPermission, type Permission } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Empty, ErrorNote, Loading } from '../../../components/bits'
import { Pager } from '../../../components/pager'
import { useAuth } from '../../auth/auth-context'
import { formatKickoff } from '../../../lib/format'
import type { Paged } from '../../../lib/use-paged'

export { usePaged } from '../../../lib/use-paged'

export const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm'
export const when = (iso: string | null) => (iso ? formatKickoff(iso) : '—')
export const toneFor = (s: string) =>
  ['failed', 'critical', 'high', 'Disputed', 'admin'].includes(s) ? 'destructive' : ['pending', 'staff', 'warning'].includes(s) ? 'secondary' : 'outline'

export function useCan() {
  const { user } = useAuth()
  return (permission: Permission) => hasPermission(user?.role, permission)
}

/** Renders children only when the signed-in role holds `permission`. */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan()(permission) ? <>{children}</> : null
}

export const Row = ({ children }: { children: ReactNode }) => (
  <div className="space-y-2 rounded-2xl border border-border p-3 text-sm">{children}</div>
)

export function Query<T>({
  query,
  children,
}: {
  query: { data: T | null; error: Error | null; loading: boolean; reload: () => void }
  children: (d: T) => ReactNode
}) {
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote error={query.error} onRetry={query.reload} />
  return query.data ? <>{children(query.data)}</> : null
}

/** Reasons are mandatory for every admin action, so every action shares this form. */
export function ReasonForm({
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
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  query,
  columns,
  rowKey,
  empty,
}: {
  query: Paged<T>
  columns: Column<T>[]
  rowKey: (row: T) => string
  empty: string
}) {
  if (query.loading) return <Loading />
  if (!query.items.length) return query.error ? <ErrorNote error={query.error} onRetry={query.reload} /> : <Empty>{empty}</Empty>

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className="px-3 py-2 font-semibold">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.pageItems.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border align-top">
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-2 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.error && <ErrorNote error={query.error} />}
      <Pager list={query} />
    </div>
  )
}
