import type { ScoreBreakdown } from '@surescore/shared'
import { Badge } from '@/components/ui/badge'
import type { LeaderboardEntry } from '../lib/types'

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

export function Leaderboard({
  entries,
  winnerCount,
  myUserId,
}: {
  entries: LeaderboardEntry[]
  winnerCount: number
  myUserId?: string
}) {
  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.userId}
          className={`space-y-2 rounded-2xl border p-3 ${entry.userId === myUserId ? 'border-primary' : 'border-border'}`}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-center text-lg font-black tabular-nums">
              {entry.breakdown ? entry.rank : '–'}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {entry.displayName ?? 'Anonymous'}
              {entry.userId === myUserId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <span className="tabular-nums">
              {entry.homeGoals} – {entry.awayGoals}
            </span>
            {entry.breakdown && <span className="w-12 text-right font-black tabular-nums">{entry.breakdown.total} pts</span>}
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
  )
}
