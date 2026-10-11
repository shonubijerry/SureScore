import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatKickoff, hasScore, isLive, matchStatusLabel } from '../lib/format'
import type { Match } from '../lib/types'

/** Score while in play or finished; "vs" before kickoff. */
export function MatchScore({ match, large }: { match: Match; large?: boolean }) {
  const text = hasScore(match) ? `${match.homeScore} – ${match.awayScore}` : 'vs'
  return <span className={`font-black tabular-nums ${large ? 'text-3xl' : 'text-lg'}`}>{text}</span>
}

export function MatchStatusBadge({ match }: { match: Match }) {
  const stale = match.freshness === 'stale' && match.status !== 'scheduled'
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={isLive(match) ? 'default' : 'outline'}>{matchStatusLabel(match)}</Badge>
      {stale && <span className="text-xs text-muted-foreground">Score may be delayed</span>}
    </span>
  )
}

export function MatchHeader({ match, large }: { match: Match; large?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">{match.league}</span>
        <span>{formatKickoff(match.kickoffTimeUtc)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className={`break-words text-right font-semibold ${large ? 'text-lg' : ''}`}>{match.homeTeam}</span>
        <MatchScore match={match} large={large} />
        <span className={`break-words font-semibold ${large ? 'text-lg' : ''}`}>{match.awayTeam}</span>
      </div>
      <MatchStatusBadge match={match} />
    </div>
  )
}

export function MatchCard({ match, footer }: { match: Match; footer?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <Link to={`/matches/${encodeURIComponent(match.cacheId)}`} className="block text-foreground">
          <MatchHeader match={match} />
        </Link>
        {footer}
      </CardContent>
    </Card>
  )
}
