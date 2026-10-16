import type { MatchStatus, PotStatus, ScoreBreakdown } from '@surescore/shared'

export interface User {
  id: string
  /** Sign-in id; null only for accounts created during phone sign-in. */
  email: string | null
  /** E.164 contact number; not verified. */
  phone: string | null
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
  homeTeamLogoUrl: string | null
  awayTeamLogoUrl: string | null
  kickoffTimeUtc: string
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  isFinalResultOfficial: boolean
  freshness: 'live' | 'cached' | 'stale'
  importance?: number
  lastRefreshedAt: string
}

export interface League {
  code: string
  name: string
  logoUrl: string
  darkLogoUrl: string
}

export interface PotCard {
  id: string
  status: PotStatus
  countryCode: string
  currency: string
  prizeAmountMinorUnits: number
  winnerCount: number
  /** Private pots are hidden from discovery and reached through their share link. */
  isPrivate: boolean
  /** Set once funded. */
  shareCode: string | null
  predictionCount: number
  predictionLocksAt: string
  createdAt: string
  match: Match
  /** The viewer's own pick, on lists that know who is viewing. */
  myPrediction?: PredictionPick | null
  /** The signed-in viewer created this pot (My pots). */
  isPotter?: boolean
}

/** One entry of `GET /api/pots/:id/predictions` (the leaderboard before lock); picks are null until predictions lock. */
export interface PotEntrant {
  id: string
  userId: string
  displayName: string | null
  submittedAt: string
  homeGoals: number | null
  awayGoals: number | null
  firstGoalMinute: number | null
}

/** Returned when a verification code has been sent. */
export interface OtpChallenge {
  /** Where the code went. */
  sentTo: string
  expiresAt: string
  resendAvailableAt: string
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
  prediction: (PredictionPick & { id: string }) | null
  final: boolean
  breakdown: ScoreBreakdown | null
}

/** Picks are null before the prediction lock; breakdown is null until there is a scoreline. */
export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string | null
  submittedAt: string
  homeGoals: number | null
  awayGoals: number | null
  firstGoalMinute: number | null
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

export interface PayoutAccount {
  id: string
  userId: string
  countryCode: string
  provider: string
  accountName: string
  accountNumber: string
  bankCode: string | null
  isDefault: boolean
  isVerified: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
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
  user?: { email: string | null; phone: string | null; displayName: string | null }
}

export interface TransferRow {
  idempotencyKey: string
  type: 'payout' | 'refund'
  status: string
  potId: string
  potStatus: string | null
  userId: string
  displayName: string | null
  email: string | null
  phone: string | null
  currency: string
  amountMinorUnits: number
  provider: string
  detail: string | null
  attempts: number
  lastAttemptAt: string
  readyToRetry: boolean
  hasPayoutAccount: boolean | null
}

export interface PotWinner {
  rank: number
  userId: string
  displayName: string | null
  email: string | null
  phone: string | null
  prediction: { homeGoals: number; awayGoals: number; firstGoalMinute: number | null; submittedAt: string }
  breakdown: ScoreBreakdown
  /** Tie-break module scores by name (higher wins). */
  tieBreaks: Record<string, number>
  /** What the prize rules award this rank (ties merge and split slots). */
  prizeMinorUnits: number
  payout: {
    idempotencyKey: string
    status: string
    amountMinorUnits: number
    reference: string | null
    detail: string | null
    lastAttemptAt: string
  } | null
}

export interface AdminPotDetail {
  pot: Omit<AdminPotRow, 'event'> & { winnerCount: number }
  event: AdminPotRow['event'] & { homeScore: number | null; awayScore: number | null; isFinalResultOfficial: boolean; firstGoalMinute: number | null }
  predictionCount: number
  /** The settling result (override or official), else the live score; null before any score. */
  result: { homeGoals: number; awayGoals: number; firstGoalMinute: number | null; final: boolean; source: 'override' | 'provider' } | null
  prize: { winnerPool: number; platformFee: number; winnerCount: number }
  winners: PotWinner[]
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

export interface AdminUserDetail {
  user: StaffUser & { emailVerifiedAt: string | null; updatedAt: string }
  payoutAccounts: (PayoutAccount & { deletedAt?: string | null })[]
  stats: { potsCreated: number; predictions: number }
  totals: { type: string; currency: string; amountMinorUnits: number }[]
}

export interface StaffUser {
  id: string
  phone: string | null
  email: string | null
  displayName: string | null
  role: 'user' | 'staff' | 'admin'
  countryCode: string
  createdAt: string
}

export interface AuditEntry {
  id: string
  actorId: string
  actorEmail: string | null
  action: string
  potId: string | null
  subject: string | null
  reason: string
  createdAt: string
}
