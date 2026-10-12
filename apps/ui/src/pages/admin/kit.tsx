// Shared building blocks for the admin console: formatting, permission gate,
// cursor-paged data hook and a paginated table. Every list is fetched through
// `usePaged` (server default 1000 rows per request, "Load more" via cursor)
// and shown through `DataTable` (client pages of 25).

import { useState, type FormEvent, type ReactNode } from 'react'
import { hasPermission, type Permission } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Empty, ErrorNote, Loading } from '../../components/bits'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatKickoff } from '../../lib/format'
import type { Page } from '../../lib/types'
import { useApi } from '../../lib/use-api'

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

/** Cursor-paged list that accumulates server pages behind a "Load more" button. */
export function usePaged<T>(path: string) {
  const first = useApi<Page<T>>(path)
  const [extra, setExtra] = useState<{ items: T[]; next: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const next = extra ? extra.next : (first.data?.nextCursor ?? null)
  const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])]

  async function more() {
    if (!next) return
    setBusy(true)
    try {
      const page = await api<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(next)}`)
      setExtra({ items: [...(extra?.items ?? []), ...page.items], next: page.nextCursor })
    } finally {
      setBusy(false)
    }
  }
  return { ...first, items, hasMore: !!next, more, busy }
}

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

const PAGE_SIZE = 25

export function DataTable<T>({
  query,
  columns,
  rowKey,
  empty,
}: {
  query: ReturnType<typeof usePaged<T>>
  columns: Column<T>[]
  rowKey: (row: T) => string
  empty: string
}) {
  const [page, setPage] = useState(0)
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote error={query.error} onRetry={query.reload} />
  if (!query.items.length) return <Empty>{empty}</Empty>

  const pages = Math.ceil(query.items.length / PAGE_SIZE)
  const current = Math.min(page, pages - 1)
  const rows = query.items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

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
            {rows.map((row) => (
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {query.items.length} loaded{query.hasMore ? '+' : ''} · page {current + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
          {query.hasMore && (
            <Button variant="outline" size="sm" onClick={query.more} disabled={query.busy}>
              {query.busy ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
