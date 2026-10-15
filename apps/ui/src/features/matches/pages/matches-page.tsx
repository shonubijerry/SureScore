import { ListState, Section } from '../components/bits'
import { MatchCard } from '../components/match-card'
import type { Match } from '../lib/types'
import { useApi } from '../lib/use-api'

export default function MatchesPage() {
  const query = useApi<{ matches: Match[] }>('/api/sports/matches/upcoming')
  const list = { ...query, data: query.data?.matches ?? null }
  return (
    <Section title="Upcoming matches">
      <ListState query={list} empty="No upcoming matches yet. Fixtures refresh every few hours.">
        {(matches) => matches.map((match) => <MatchCard key={match.cacheId} match={match} />)}
      </ListState>
    </Section>
  )
}
