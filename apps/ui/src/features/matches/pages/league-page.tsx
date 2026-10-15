import { Link, useParams } from 'react-router-dom'
import { getLeagueConfig } from '@surescore/shared'
import { Empty } from '../../../components/bits'
import { LeagueLogo } from '../components/league-grid'
import { MatchTabs } from '../components/match-tabs'

/** Every cached match of one league: upcoming, live and recent results. */
export default function LeaguePage() {
  const code = useParams().code ?? ''
  const league = getLeagueConfig(code)
  if (!league) return <Empty>This league isn&apos;t supported. <Link to="/" className="font-semibold underline">Back home</Link></Empty>

  const q = `?league=${encodeURIComponent(code)}`
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <LeagueLogo league={league} className="size-14" />
        <h1 className="text-2xl font-black tracking-tight">{league.name}</h1>
      </div>
      <MatchTabs
        label={`${league.name} matches`}
        tabs={[
          { key: 'upcoming', label: 'Upcoming', path: `/api/sports/matches/upcoming${q}`, empty: 'No upcoming matches in this league yet.' },
          { key: 'live', label: 'Live', path: `/api/sports/matches/live${q}`, empty: 'No live matches in this league right now.' },
          { key: 'results', label: 'Results', path: `/api/sports/matches/results${q}`, empty: 'No results yet.' },
        ]}
      />
    </div>
  )
}
