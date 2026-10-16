import { Button } from '@/components/ui/button'
import type { Pages } from '../lib/use-paged'

type PagerState = Omit<Pages<unknown>, 'pageItems'> & { hasMore?: boolean; loadingMore?: boolean; loadMore?: () => void }

/**
 * Previous / Next over the loaded rows, and "Load more" on the last page when the server has
 * another batch. Every list in the app uses it, so paging looks and behaves the same everywhere.
 */
export function Pager({ list }: { list: PagerState }) {
  const { page, pageCount, pageSize, total, setPage, hasMore, loadingMore, loadMore } = list
  if (pageCount <= 1 && !hasMore) return null
  const last = page >= pageCount - 1

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} of {total}
        {hasMore ? '+' : ''}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={last} onClick={() => setPage(page + 1)}>
          Next
        </Button>
        {hasMore && last && loadMore && (
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </div>
    </nav>
  )
}
