import { Link } from 'react-router-dom'
import { getLeagueConfig } from '@surescore/shared'
import { Empty, ErrorNote, Loading, Section } from '../../../components/bits'
import { Pager } from '../../../components/pager'
import { LeagueLogo } from '../components/league-grid'
import { MatchCard } from '../components/match-card'
import { leagueName } from '../../../lib/format'
import type { Match } from '../../../lib/types'
import { usePaged } from '../../../lib/use-paged'

/** Groups matches by league, keeping the API's kickoff order: leagues by their first match, matches within each. */
function byLeague(matches: Match[]) {
  const groups = new Map<string, Match[]>()
  for (const match of matches) groups.set(match.league, [...(groups.get(match.league) ?? []), match])
  return [...groups]
}

function LeagueHeading({ code }: { code: string }) {
  const league = getLeagueConfig(code)
  const content = (
    <>
      {league && <LeagueLogo league={league} className="size-7" />}
      <h3 className="text-base font-bold tracking-tight">{leagueName(code)}</h3>
    </>
  )
  return league ? (
    <Link to={`/leagues/${encodeURIComponent(code)}`} className="flex w-fit items-center gap-2 text-foreground hover:underline">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-2">{content}</div>
  )
}

function UpcomingMatches() {
  const list = usePaged<Match, 'matches'>('/api/sports/matches/upcoming', 'matches')
  if (list.loading) return <Loading />
  if (!list.items.length)
    return list.error ? <ErrorNote error={list.error} onRetry={list.reload} /> : <Empty>No upcoming matches yet. Fixtures refresh every few hours.</Empty>

  return (
    <div className="space-y-6">
      {byLeague(list.pageItems).map(([code, leagueMatches]) => (
        <section key={code} className="space-y-3">
          <LeagueHeading code={code} />
          <div className="grid gap-3 md:grid-cols-2">
            {leagueMatches.map((match) => (
              <MatchCard key={match.cacheId} match={match} />
            ))}
          </div>
        </section>
      ))}
      {list.error && <ErrorNote error={list.error} />}
      <Pager list={list} />
    </div>
  )
}

export default function MatchesPage() {
  return (
    <Section title="Upcoming matches">
      <UpcomingMatches />
    </Section>
  )
}
