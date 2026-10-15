import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Breakdown, Leaderboard as LeaderboardList } from '../components/leaderboard'
import { Empty, ErrorNote, Loading, Section, SignInPrompt } from '../../../components/bits'
import { MatchHeader } from '../../matches/components/match-card'
import { PredictionForm, Stepper } from '../components/prediction-form'
import { ShareButtons } from '../components/share-buttons'
import { queryString } from '../../../lib/api'
import { useAuth } from '../../auth/auth-context'
import { formatKickoff, formatMoney, isLocked } from '../../../lib/format'
import type { Leaderboard, PotCard, PotSettlement, PredictionView } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

const LIVE_REFRESH_MS = 120_000
const CLOSED_STATUSES = ['Cancelled', 'Refunded']

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}

function GuestPrediction({ pot }: { pot: PotCard }) {
  const navigate = useNavigate()
  // Keep the share code, so a private pot is still reachable after signing in.
  const { pathname, search } = useLocation()
  const here = `${pathname}${search}`
  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)

  const handlePredict = () => {
    navigate('/signup', { state: { from: here } })
  }

  return (
    <Section title="Make your prediction">
      <Card size="sm">
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Predict the score after 90 minutes. Extra time and penalties don't count.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label={pot.match.homeTeam} value={home} onChange={setHome} />
            <Stepper label={pot.match.awayTeam} value={away} onChange={setAway} />
          </div>
          <div className="space-y-2 pt-2">
            <Button size="lg" className="h-12 w-full text-base" onClick={handlePredict}>
              Predict – Sign up to lock in
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" state={{ from: here }} className="font-semibold underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </Section>
  )
}

function MyPrediction({ pot, canPredict, shareCode }: { pot: PotCard; canPredict: boolean; shareCode?: string }) {
  const { user } = useAuth()
  const mine = useApi<PredictionView>(user ? `/api/pots/${pot.id}/predictions/me` : null, LIVE_REFRESH_MS)
  const existing = mine.data?.prediction ?? null

  if (!user) return null
  if (mine.loading) return <Loading />
  if (mine.error && mine.error.status !== 404) return <ErrorNote error={mine.error} onRetry={mine.reload} />

  return (
    <Section title={existing ? 'Your prediction' : 'Make your prediction'}>
      <Card size="sm">
        <CardContent className="space-y-3">
          {canPredict ? (
            <PredictionForm potId={pot.id} match={pot.match} existing={existing} shareCode={shareCode} onSaved={mine.reload} />
          ) : existing ? (
            <p className="text-lg font-bold">
              {pot.match.homeTeam} {existing.homeGoals} – {existing.awayGoals} {pot.match.awayTeam}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You didn't predict this pot.</p>
          )}
          {existing && mine.data?.breakdown && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {mine.data.breakdown.total} points{mine.data.final ? '' : ' (provisional)'}
              </p>
              <Breakdown breakdown={mine.data.breakdown} />
            </div>
          )}
        </CardContent>
      </Card>
    </Section>
  )
}

const TRANSFER_LABEL = { pending: 'In progress', successful: 'Completed', failed: 'Failed – will be retried' } as const

/** Payout/refund progress; the server scopes it to the potter (all) or a player (own payout). */
function Settlement({ pot }: { pot: PotCard }) {
  const { user } = useAuth()
  const query = useApi<PotSettlement>(user ? `/api/pots/${pot.id}/settlement` : null, LIVE_REFRESH_MS)
  const transfers = query.data ? [...(query.data.refund ? [query.data.refund] : []), ...query.data.payouts] : []

  if (!user || query.error || query.loading) return null
  if (!transfers.length) {
    return query.data?.potStatus === 'Cancelled' ? <Empty>Refund is being initiated.</Empty> : null
  }

  return (
    <Section title="Payouts & refunds">
      <Card size="sm">
        <CardContent className="space-y-2">
          {transfers.map((t) => (
            <div key={`${t.type}:${t.userId}`} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t.type === 'refund' ? 'Refund to potter' : t.userId === user.id ? 'Your winnings' : (t.displayName ?? 'Winner')}
              </span>
              <span className="text-right">
                <span className="font-bold">{formatMoney(t.amountMinorUnits, pot.currency)}</span>
                <span className="block text-xs text-muted-foreground">{TRANSFER_LABEL[t.status]}</span>
                {t.status === 'failed' && t.detail && t.userId === user.id && (
                  <span className="block text-xs text-destructive">{t.detail}</span>
                )}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </Section>
  )
}

function Predictions({ pot, locked, shareCode }: { pot: PotCard; locked: boolean; shareCode?: string }) {
  const { user } = useAuth()
  const board = useApi<Leaderboard>(
    locked && user ? `/api/pots/${pot.id}/leaderboard${queryString({ code: shareCode })}` : null,
    LIVE_REFRESH_MS,
  )

  return (
    <Section title="Leaderboard">
      {!locked ? (
        <Empty>Predictions stay hidden until {formatKickoff(pot.predictionLocksAt)}, when the pot locks.</Empty>
      ) : !user ? (
        <SignInPrompt>Sign in to view the leaderboard.</SignInPrompt>
      ) : board.loading ? (
        <Loading />
      ) : board.error ? (
        <ErrorNote error={board.error} onRetry={board.reload} />
      ) : !board.data?.entries.length ? (
        <Empty>No predictions were made.</Empty>
      ) : (
        <>
          {!board.data.final && <p className="text-xs text-muted-foreground">Provisional ranking until the result is official.</p>}
          <LeaderboardList entries={board.data.entries} winnerCount={pot.winnerCount} myUserId={user.id} />
        </>
      )}
    </Section>
  )
}

export default function PotDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const shareCode = useSearchParams()[0].get('code') ?? undefined
  const query = useApi<{ pot: PotCard }>(`/api/discover/pots/${id}${queryString({ code: shareCode })}`, LIVE_REFRESH_MS)

  if (query.loading) return <Loading />
  if (query.error?.status === 404) {
    return <Empty>This pot doesn't exist, or it's private. Ask the potter for its link.</Empty>
  }
  if (query.error || !query.data) return <ErrorNote error={query.error ?? new Error('Pot not found.')} onRetry={query.reload} />

  const { pot } = query.data
  const locked = isLocked(pot.predictionLocksAt)
  const closed = CLOSED_STATUSES.includes(pot.status)
  const canPredict = pot.status === 'Open' && !locked && user?.countryCode === pot.countryCode

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          {pot.isPrivate && (
            <Badge variant="outline" className="gap-1">
              <Lock aria-hidden className="size-3" /> Private pot
            </Badge>
          )}
          <MatchHeader match={pot.match} large />
          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <Fact label="Prize" value={formatMoney(pot.prizeAmountMinorUnits, pot.currency)} />
            <Fact label="Winners" value={String(pot.winnerCount)} />
            <Fact label="Players" value={String(pot.predictionCount)} />
            <Fact label="Pot status" value={pot.status} />
          </dl>
          {!locked && !closed && <p className="text-xs text-muted-foreground">Predictions lock {formatKickoff(pot.predictionLocksAt)}.</p>}
          {closed && <p className="text-sm text-destructive">This pot was cancelled. Any stake is refunded.</p>}
          {!closed && <ShareButtons pot={pot} />}
        </CardContent>
      </Card>

      {user && pot.status === 'Open' && !locked && user.countryCode !== pot.countryCode && (
        <Empty>This pot pays out in {pot.currency} and is only open to players in {pot.countryCode}.</Empty>
      )}
      {!closed && !user && pot.status === 'Open' && !locked && <GuestPrediction pot={pot} />}
      {!closed && user && <MyPrediction pot={pot} canPredict={canPredict} shareCode={shareCode} />}
      {!closed && <Predictions pot={pot} locked={locked} shareCode={shareCode} />}
      <Settlement pot={pot} />
    </>
  )
}
