import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ListState, Section } from '../components/bits'
import { MatchCard } from '../components/match-card'
import { PotCard } from '../components/pot-card'
import { useAuth } from '../lib/auth'
import type { Match, PredictedPot } from '../lib/types'
import { useApi } from '../lib/use-api'

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

function UpcomingMatches() {
  const query = useApi<{ matches: Match[] }>('/api/sports/upcoming?limit=10')
  const list = { ...query, data: query.data?.matches ?? null }

  return (
    <ListState query={list} empty="No upcoming matches yet.">
      {(items) => items.map((match) => <MatchCard key={match.cacheId} match={match} />)}
    </ListState>
  )
}

function PopularMatches() {
  const query = useApi<{ matches: (Match & { potCount: number })[] }>('/api/discover/matches/popular')
  const list = { ...query, data: query.data?.matches ?? null }

  return (
    <ListState query={list} empty="No upcoming matches yet.">
      {(items) =>
        items.map((match) => (
          <MatchCard
            key={match.cacheId}
            match={match}
            footer={<p className="text-xs text-muted-foreground">{match.potCount} active pot{match.potCount === 1 ? '' : 's'}</p>}
          />
        ))
      }
    </ListState>
  )
}

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
        title="Popular matches"
        action={
          <Link to="/pots" className="text-sm font-semibold">
            All pots →
          </Link>
        }
      >
        <PopularMatches />
      </Section>
      {!user && (
        <Section title="Upcoming matches">
          <UpcomingMatches />
        </Section>
      )}
      <Link to="/matches" className="block">
        <Button size="lg" className="h-12 w-full text-base">
          Browse matches & create a pot
        </Button>
      </Link>
    </>
  )
}
