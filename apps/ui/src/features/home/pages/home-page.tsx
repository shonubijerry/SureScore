import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ListState, Section } from '../../../components/bits'
import { LeagueGrid } from '../../matches/components/league-grid'
import { MatchTabs, type MatchTab } from '../../matches/components/match-tabs'
import { PotCard } from '../../pots/components/pot-card'
import { useAuth } from '../../auth/auth-context'
import type { PredictedPot } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

// Live scores refresh server-side every 10 minutes; polling faster adds nothing.
const LIVE_REFRESH_MS = 120_000

function MyMatches() {
  const query = useApi<{ predictions: PredictedPot[] }>('/api/pots/predicted', LIVE_REFRESH_MS)
  const list = { ...query, data: query.data?.predictions ?? null }

  return (
    <ListState query={list} empty="You haven't predicted any upcoming or live matches yet. Pick a pot below!">
      {(items) =>
        items.map(({ pot, homeGoals, awayGoals }) => (
          <PotCard key={pot.id} pot={pot}>
            <p className="rounded-xl bg-muted px-3 py-2 text-sm">
              Your pick:{' '}
              <strong>
                {pot.match.homeTeam} {homeGoals} – {awayGoals} {pot.match.awayTeam}
              </strong>
            </p>
          </PotCard>
        ))
      }
    </ListState>
  )
}

const HOME_TABS: MatchTab[] = [
  { key: 'popular', label: 'Popular', path: '/api/discover/matches/popular', empty: 'No popular matches yet.' },
  { key: 'upcoming', label: 'Upcoming', path: '/api/sports/matches/upcoming', empty: 'No upcoming matches yet. Fixtures refresh every few hours.' },
  { key: 'live', label: 'Live', path: '/api/sports/matches/live', empty: 'No matches are live right now.' },
]

export default function HomePage() {
  const { user } = useAuth()
  return (
    <>
      {user ? (
        <Section title="Your matches">
          <MyMatches />
        </Section>
      ) : null}
      <Section
        title="Matches"
        action={
          <Link to="/pots" className="text-sm font-semibold">
            All pots →
          </Link>
        }
      >
        <MatchTabs label="Matches" tabs={HOME_TABS} />
      </Section>
      <LeagueGrid countryCode={user?.countryCode} />
      <Link to="/matches" className="block">
        <Button size="lg" className="h-12 w-full text-base">
          Browse matches & create a pot
        </Button>
      </Link>
    </>
  )
}
