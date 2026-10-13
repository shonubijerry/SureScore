import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatKickoff, hasScore, isLive, leagueName, matchStatusLabel } from '../lib/format'
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

/** Logo above the name; lazy-loaded and decoded off-thread so it never blocks first paint. */
function TeamName({ name, logoUrl, large }: { name: string; logoUrl: string | null; large?: boolean }) {
  const size = large ? 'size-14' : 'size-10'
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={64}
          height={64}
          className={`${size} object-contain`}
          onError={(e) => (e.currentTarget.hidden = true)}
        />
      )}
      <span className={`break-words font-semibold ${large ? 'text-lg' : ''}`}>{name}</span>
    </span>
  )
}

export function MatchHeader({ match, large }: { match: Match; large?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">{leagueName(match.league)}</span>
        <span>{formatKickoff(match.kickoffTimeUtc)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamName name={match.homeTeam} logoUrl={match.homeTeamLogoUrl} large={large} />
        <MatchScore match={match} large={large} />
        <TeamName name={match.awayTeam} logoUrl={match.awayTeamLogoUrl} large={large} />
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
