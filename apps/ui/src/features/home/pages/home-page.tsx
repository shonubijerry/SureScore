import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Section } from '../../../components/bits'
import { LeagueGrid } from '../../matches/components/league-grid'
import { MatchTabs, type MatchTab } from '../../matches/components/match-tabs'
import { PotList } from '../../pots/components/pot-list'
import { useAuth } from '../../auth/auth-context'
import type { PredictedPot } from '../../../lib/types'
import { usePaged } from '../../../lib/use-paged'

// Live scores refresh server-side every 10 minutes; polling faster adds nothing.
const LIVE_REFRESH_MS = 120_000

function MyMatches() {
  const list = usePaged<PredictedPot, 'predictions'>('/api/pots/predicted', 'predictions', { refreshMs: LIVE_REFRESH_MS })
  const pageItems = list.pageItems.map(({ pot, ...myPrediction }) => ({ ...pot, myPrediction }))
  return <PotList list={{ ...list, pageItems }} empty="You haven't predicted any upcoming or live matches yet. Pick a pot below!" />
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
