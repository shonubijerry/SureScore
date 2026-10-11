import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ListState, Section, SignInPrompt } from '../components/bits'
import { MatchCard } from '../components/match-card'
import { PotCard } from '../components/pot-card'
import { useAuth } from '../lib/auth'
import { queryString } from '../lib/api'
import type { Match, PredictedPot } from '../lib/types'
import { useApi } from '../lib/use-api'

// Live scores refresh server-side every 10 minutes; polling faster adds nothing.
const LIVE_REFRESH_MS = 120_000

function MyMatches() {
  const { user } = useAuth()
  const query = useApi<{ predictions: PredictedPot[] }>(user ? '/api/pots/predicted' : null, LIVE_REFRESH_MS)
  const list = { ...query, data: query.data?.predictions ?? null }

  if (!user) return <SignInPrompt>Sign in to see the matches you've predicted.</SignInPrompt>
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

function PopularMatches() {
  const { user } = useAuth()
  const query = useApi<{ matches: (Match & { potCount: number })[] }>(
    `/api/discover/matches/popular${queryString({ countryCode: user?.countryCode })}`,
  )
  const list = { ...query, data: query.data?.matches ?? null }

  return (
    <ListState query={list} empty="No matches have active pots yet.">
      {(items) =>
        items.map((match) => (
          <MatchCard
            key={match.cacheId}
            match={match}
            footer={<p className="text-xs text-muted-foreground">{match.potCount} active pot{match.potCount > 1 ? 's' : ''}</p>}
          />
        ))
      }
    </ListState>
  )
}

export default function HomePage() {
  return (
    <>
      <Section title="Your matches">
        <MyMatches />
      </Section>
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
      <Link to="/matches" className="block">
        <Button size="lg" className="h-12 w-full text-base">
          Browse matches & create a pot
        </Button>
      </Link>
    </>
  )
}
