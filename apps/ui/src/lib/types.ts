import type { MatchStatus, PotStatus, ScoreBreakdown } from '@surescore/shared'

export interface User {
  id: string
  email: string
  countryCode: string
  displayName: string | null
  role: string
}

export interface Match {
  id: string
  cacheId: string
  provider: string
  league: string
  homeTeam: string
  awayTeam: string
  kickoffTimeUtc: string
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  isFinalResultOfficial: boolean
  freshness: 'live' | 'cached' | 'stale'
  lastRefreshedAt: string
}

export interface PotCard {
  id: string
  status: PotStatus
  countryCode: string
  currency: string
  prizeAmountMinorUnits: number
  winnerCount: number
  shareCode: string | null
  predictionCount: number
  predictionLocksAt: string
  createdAt: string
  match: Match
}

export interface PredictionPick {
  homeGoals: number
  awayGoals: number
  firstGoalMinute: number | null
}

export interface PredictedPot extends PredictionPick {
  pot: PotCard
}

export interface PredictionView {
  prediction: PredictionPick & { id: string }
  final: boolean
  breakdown: ScoreBreakdown | null
}

export interface LeaderboardEntry extends PredictionPick {
  rank: number
  userId: string
  displayName: string | null
  breakdown: ScoreBreakdown | null
}

export interface Leaderboard {
  final: boolean
  entries: LeaderboardEntry[]
}

export interface Country {
  code: string
  name: string
  currency: string
  isLaunched: boolean
}

export interface TransferStatus {
  type: 'payout' | 'refund'
  userId: string
  displayName: string | null
  status: 'pending' | 'successful' | 'failed'
  amountMinorUnits: number
  reference: string | null
  detail: string | null
}

export interface PotSettlement {
  potId: string
  potStatus: PotStatus
  currency: string
  refund: TransferStatus | null
  payouts: TransferStatus[]
}
