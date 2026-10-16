import type { ReactNode } from 'react'
import { Empty, ErrorNote, Loading } from '../../../components/bits'
import { Pager } from '../../../components/pager'
import type { PotCard as Pot } from '../../../lib/types'
import type { Paged } from '../../../lib/use-paged'
import { PotCard } from './pot-card'

/**
 * The one grid of pot cards over a `usePaged` list: loading, error and empty states, the current
 * page of cards, and the pager. `extra` adds content under a card; `linked` turns off the link to
 * the pot page (e.g. unfunded Draft pots).
 */
export function PotList<T extends Pot>({
  list,
  empty,
  extra,
  linked,
}: {
  /** A `usePaged` list; only the current page has to be pot cards (callers may map just that page). */
  list: Omit<Paged<unknown>, 'pageItems'> & { pageItems: T[] }
  empty: ReactNode
  extra?: (pot: T) => ReactNode
  linked?: (pot: T) => boolean
}) {
  if (list.loading) return <Loading />
  if (!list.items.length) return list.error ? <ErrorNote error={list.error} onRetry={list.reload} /> : <Empty>{empty}</Empty>

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {list.pageItems.map((pot) => (
          <PotCard key={pot.id} pot={pot} linked={linked?.(pot) ?? true}>
            {extra?.(pot)}
          </PotCard>
        ))}
      </div>
      {list.error && <ErrorNote error={list.error} />}
      <Pager list={list} />
    </div>
  )
}
