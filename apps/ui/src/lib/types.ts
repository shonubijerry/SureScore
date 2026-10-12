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

// ---- Admin console ----

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface AdminPotRow {
  id: string
  status: PotStatus
  currency: string
  prizeAmountMinorUnits: number
  updatedAt: string
  event: { homeTeam: string; awayTeam: string; kickoffTimeUtc: string; status: string }
}

export interface LedgerRow {
  id: string
  idempotencyKey: string
  type: string
  status: string
  userId: string
  potId: string
  currency: string
  amountMinorUnits: number
  provider: string
  reference: string | null
  detail: string | null
  createdAt: string
  user?: { email: string; displayName: string | null }
}

export interface TransferRow {
  idempotencyKey: string
  type: 'payout' | 'refund'
  status: string
  potId: string
  potStatus: string | null
  email: string | null
  currency: string
  amountMinorUnits: number
  provider: string
  detail: string | null
  attempts: number
  lastAttemptAt: string
  readyToRetry: boolean
  hasPayoutAccount: boolean | null
}

export interface AdminPotDetail {
  pot: Omit<AdminPotRow, 'event'>
  event: AdminPotRow['event']
  predictionCount: number
  override: { homeGoals: number; awayGoals: number; reason: string } | null
  transitions: { id: string; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }[]
  notes: { id: string; action: string; reason: string; createdAt: string; actorId: string }[]
  ledger: LedgerRow[]
}

export interface ProviderHealth {
  sports: { provider: string; events: number; stale: number; lastRefreshedAt: string | null; failedJobs24h: number }[]
  payments: {
    provider: string
    successful24h: number
    pending24h: number
    failed24h: number
    failureRate: number
    lastFailureAt: string | null
    lastFailureDetail: string | null
  }[]
  jobs: { job: string; kind: string; runs24h: number; failures24h: number; lastRunAt: string | null }[]
  recentFailures: { id: string; job: string; startedAt: string; error: string | null }[]
}

export interface Finding {
  id: string
  code: string
  severity: 'critical' | 'high' | 'medium'
  potId: string | null
  detail: string
  createdAt: string
}

export interface ReconciliationStatus {
  run: { startedAt: string; status?: string; summary: unknown } | null
  open: Record<string, number>
}
