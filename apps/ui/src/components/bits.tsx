import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function Loading() {
  return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <p>{error.message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Renders a list's loading / error / empty states, then the items. */
export function ListState<T>({
  query,
  empty,
  children,
}: {
  query: { data: T[] | null; error: Error | null; loading: boolean; reload: () => void }
  empty: ReactNode
  children: (items: T[]) => ReactNode
}) {
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote error={query.error} onRetry={query.reload} />
  if (!query.data?.length) return <Empty>{empty}</Empty>
  return <div className="grid gap-3 md:grid-cols-2">{children(query.data)}</div>
}

export function SignInPrompt({ children }: { children: ReactNode }) {
  return (
    <Empty>
      {children}{' '}
      <Link to="/login" className="font-semibold underline">
        Sign in
      </Link>
    </Empty>
  )
}
