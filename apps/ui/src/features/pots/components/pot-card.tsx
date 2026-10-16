import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '../../../lib/format'
import type { PotCard as Pot } from '../../../lib/types'
import { MatchHeader } from '../../matches/components/match-card'

export function PotCard({ pot, children, linked = true }: { pot: Pot; children?: ReactNode; linked?: boolean }) {
  const body = (
    <>
      <MatchHeader match={pot.match} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xl font-black">{formatMoney(pot.prizeAmountMinorUnits, pot.currency)}</span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {pot.winnerCount} winner{pot.winnerCount > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Users aria-hidden className="size-3" /> {pot.predictionCount}
          </span>
          {pot.isPrivate && (
            <Badge variant="outline" className="gap-1">
              <Lock aria-hidden className="size-3" /> Private
            </Badge>
          )}
          <Badge variant="outline">{pot.status}</Badge>
        </span>
      </div>
    </>
  )
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        {linked ? (
          <Link to={`/pots/${pot.id}`} className="block space-y-3 text-foreground">
            {body}
          </Link>
        ) : (
          <div className="space-y-3">{body}</div>
        )}
        {pot.myPrediction && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm">
            Your pick:{' '}
            <strong>
              {pot.match.homeTeam} {pot.myPrediction.homeGoals} – {pot.myPrediction.awayGoals} {pot.match.awayTeam}
            </strong>
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
