import { useState } from 'react'
import type { ScoreBreakdown } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKickoff } from '../../../lib/format'
import type { LeaderboardEntry } from '../../../lib/types'

const PARTS: [keyof ScoreBreakdown, string][] = [
  ['outcome', 'Result'],
  ['exactScoreline', 'Exact score'],
  ['goalDifference', 'Goal diff'],
  ['homeGoals', 'Home goals'],
  ['awayGoals', 'Away goals'],
]

/** Points per scoring rule, so users can see exactly where a total came from. */
export function Breakdown({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {PARTS.map(([key, label]) => (
        <li key={key}>
          <Badge variant={breakdown[key] > 0 ? 'default' : 'outline'} className="font-normal">
            {label} +{breakdown[key]}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/** Rows revealed per "Show more". */
const VIEW_SIZE = 50

/**
 * Ranked entries, 50 on screen at a time. Before lock entries come without picks or breakdowns, so
 * everyone shows 0 pts. A paged source passes `hasMore`/`loadMore`: the next batch is fetched only
 * once every loaded row is on screen.
 */
export function Leaderboard({
  entries,
  winnerCount,
  myUserId,
  hasMore = false,
  loadingMore = false,
  loadMore,
}: {
  entries: LeaderboardEntry[]
  winnerCount: number
  myUserId?: string
  hasMore?: boolean
  loadingMore?: boolean
  loadMore?: () => Promise<void>
}) {
  const [shown, setShown] = useState(VIEW_SIZE)

  const showMore = async () => {
    if (shown >= entries.length && hasMore) await loadMore?.()
    setShown((n) => n + VIEW_SIZE)
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {entries.slice(0, shown).map((entry) => (
          <li
            key={entry.userId}
            className={`space-y-2 rounded-2xl border p-3 ${entry.userId === myUserId ? 'border-primary' : 'border-border'}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-center text-lg font-black tabular-nums">
                {entry.breakdown ? entry.rank : '–'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {entry.displayName ?? 'Anonymous'}
                  {entry.userId === myUserId && <span className="text-muted-foreground"> (you)</span>}
                </span>
                <span className="block text-xs text-muted-foreground">Predicted {formatKickoff(entry.submittedAt)}</span>
              </span>
              {entry.homeGoals !== null && entry.awayGoals !== null && (
                <span className="tabular-nums">
                  {entry.homeGoals} – {entry.awayGoals}
                </span>
              )}
              <span className="w-12 text-right font-black tabular-nums">{entry.breakdown?.total ?? 0} pts</span>
            </div>
            {entry.breakdown && (
              <div className="flex flex-wrap items-center gap-2 pl-11">
                {entry.rank <= winnerCount && <Badge>Prize position</Badge>}
                <Breakdown breakdown={entry.breakdown} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {(shown < entries.length || hasMore) && (
        <Button variant="outline" size="lg" className="h-11 w-full" onClick={showMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </div>
  )
}
