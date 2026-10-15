import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Match } from '../../../lib/types'
import { usePagedMatches } from '../../../lib/use-paged'
import { Empty, ErrorNote, Loading } from '../../../components/bits'
import { MatchCard } from './match-card'

const PAGE_SIZE = 4

export interface MatchTab {
  key: string
  label: string
  /** Paged endpoint returning `{ matches, nextCursor }`. */
  path: string
  empty: string
}

type ListedMatch = Match & { potCount?: number }

function TabList({ tab }: { tab: MatchTab }) {
  const list = usePagedMatches<ListedMatch>(tab.path, PAGE_SIZE)

  if (list.loading) return <Loading />
  if (!list.items.length) return list.error ? <ErrorNote error={list.error} onRetry={list.reload} /> : <Empty>{tab.empty}</Empty>

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {list.items.map((match) => (
          <MatchCard
            key={match.cacheId}
            match={match}
            footer={
              match.potCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {match.potCount} active pot{match.potCount === 1 ? '' : 's'}
                </p>
              )
            }
          />
        ))}
      </div>
      {list.error && <ErrorNote error={list.error} />}
      {list.hasMore && (
        <Button variant="outline" size="lg" className="h-11 w-full" onClick={list.loadMore} disabled={list.loadingMore}>
          {list.loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}

/** Tabbed match lists, 4 at a time with "Load more". The open tab is kept in the URL (`?tab=`). */
export function MatchTabs({ tabs, label }: { tabs: MatchTab[]; label: string }) {
  const [params, setParams] = useSearchParams()
  const active = tabs.find((t) => t.key === params.get('tab')) ?? tabs[0]

  const select = (key: string) => {
    const next = new URLSearchParams(params)
    if (key === tabs[0].key) next.delete('tab')
    else next.set('tab', key)
    setParams(next, { replace: true })
  }

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label={label} className="grid gap-1 rounded-2xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={tab.key === active.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => select(tab.key)}
            className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
              tab.key === active.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active.key}`} aria-labelledby={`tab-${active.key}`}>
        {/* Keyed so switching tabs starts the list from its first page. */}
        <TabList key={active.path} tab={active} />
      </div>
    </section>
  )
}
