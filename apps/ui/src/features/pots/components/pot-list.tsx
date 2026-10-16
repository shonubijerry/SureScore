import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, ErrorNote, Loading } from '../../../components/bits'
import type { ApiError } from '../../../lib/api'
import type { PotCard as Pot } from '../../../lib/types'
import { PotCard } from './pot-card'

export interface PotListState<T extends Pot> {
  items: T[]
  loading: boolean
  error: ApiError | null
  reload: () => void
  /** Paged lists (`usePaged`) add "Load more". */
  hasMore?: boolean
  loadingMore?: boolean
  loadMore?: () => void
}

/** Adapts a `useApi` result to a `PotList` state. */
export const fromQuery = <T extends Pot>(
  { loading, error, reload }: { loading: boolean; error: ApiError | null; reload: () => void },
  items: T[] | undefined,
): PotListState<T> => ({ loading, error, reload, items: items ?? [] })

/**
 * The one grid of pot cards: loading, error and empty states, the cards, and "Load more" for paged lists.
 * `extra` adds content under a card; `linked` turns off the link to the pot page (e.g. unfunded Draft pots).
 */
export function PotList<T extends Pot>({
  list,
  empty,
  extra,
  linked,
}: {
  list: PotListState<T>
  empty: ReactNode
  extra?: (pot: T) => ReactNode
  linked?: (pot: T) => boolean
}) {
  if (list.loading) return <Loading />
  if (!list.items.length) return list.error ? <ErrorNote error={list.error} onRetry={list.reload} /> : <Empty>{empty}</Empty>

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {list.items.map((pot) => (
          <PotCard key={pot.id} pot={pot} linked={linked?.(pot) ?? true}>
            {extra?.(pot)}
          </PotCard>
        ))}
      </div>
      {list.error && <ErrorNote error={list.error} />}
      {list.hasMore && list.loadMore && (
        <Button variant="outline" size="lg" className="h-11 w-full" onClick={list.loadMore} disabled={list.loadingMore}>
          {list.loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
