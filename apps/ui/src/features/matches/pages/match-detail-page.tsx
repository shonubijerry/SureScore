import { Link, useParams } from 'react-router-dom'
import { isMatchBookable } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNote, Loading, Section } from '../../../components/bits'
import { MatchHeader } from '../components/match-card'
import { fromQuery, PotList } from '../../pots/components/pot-list'
import { queryString } from '../../../lib/api'
import type { Match, PotCard as Pot } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

export default function MatchDetailPage() {
  const { id = '' } = useParams()
  const match = useApi<{ match: Match }>(`/api/sports/matches/${encodeURIComponent(id)}`)
  const pots = useApi<{ pots: Pot[] }>(`/api/discover/pots${queryString({ eventId: id })}`)

  if (match.loading) return <Loading />
  if (match.error || !match.data) return <ErrorNote error={match.error ?? new Error('Match not found.')} onRetry={match.reload} />

  const m = match.data.match
  const canCreate = isMatchBookable(m.status, new Date(m.kickoffTimeUtc), new Date())

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <MatchHeader match={m} large />
          {canCreate ? (
            <Link to={`/pots/new?match=${encodeURIComponent(m.cacheId)}`} className="block">
              <Button size="lg" className="h-12 w-full text-base">
                Create a pot for this match
              </Button>
            </Link>
          ) : (
            <p className="text-center text-sm text-muted-foreground">New pots are closed for this match.</p>
          )}
        </CardContent>
      </Card>
      <Section title="Pots for this match">
        <PotList list={fromQuery(pots, pots.data?.pots)} empty="No public pots for this match yet." />
      </Section>
    </>
  )
}
