import { Link } from 'react-router-dom'
import { getLeagueConfig } from '@surescore/shared'
import { ListState, Section } from '../../../components/bits'
import { LeagueLogo } from '../components/league-grid'
import { MatchCard } from '../components/match-card'
import { leagueName } from '../../../lib/format'
import type { Match } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

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

export default function MatchesPage() {
  const query = useApi<{ matches: Match[] }>('/api/sports/matches/upcoming')
  const list = { ...query, data: query.data?.matches ?? null }
  return (
    <Section title="Upcoming matches">
      <ListState query={list} empty="No upcoming matches yet. Fixtures refresh every few hours.">
        {(matches) =>
          byLeague(matches).map(([code, leagueMatches]) => (
            <section key={code} className="space-y-3 md:col-span-2">
              <LeagueHeading code={code} />
              <div className="grid gap-3 md:grid-cols-2">
                {leagueMatches.map((match) => (
                  <MatchCard key={match.cacheId} match={match} />
                ))}
              </div>
            </section>
          ))
        }
      </ListState>
    </Section>
  )
}
