import type { Match } from './types'
import { getLeagueConfig, liveMatchStatuses } from '@surescore/shared'

// Every supported currency is currently a 2-decimal currency (e.g. NGN/kobo).
export const MINOR_UNITS_PER_MAJOR = 100

export const toMinorUnits = (major: number) => Math.round(major * MINOR_UNITS_PER_MAJOR)

export const formatMoney = (minorUnits: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minorUnits / MINOR_UNITS_PER_MAJOR,
  )

export const formatKickoff = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )

export const isLive = (match: Match) => liveMatchStatuses.includes(match.status)

// Providers report 0-0 for fixtures that haven't kicked off, so a score is shown only while live or at full time.
export const hasScore = (match: Match) =>
  (isLive(match) || match.status === 'full time') && match.homeScore !== null && match.awayScore !== null

export const isLocked = (lockIso: string) => Date.now() >= new Date(lockIso).getTime()

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Upcoming',
  'first half': 'Live · 1st half',
  'half time': 'Live · Half time',
  'second half': 'Live · 2nd half',
  'full time': 'Full time',
  postponed: 'Postponed',
  abandoned: 'Abandoned',
}

export const matchStatusLabel = (match: Match) => STATUS_LABELS[match.status] ?? match.status

/** Date inputs are local calendar days; the API filters on kickoff instants. */
export const startOfDayIso = (date: string) => new Date(`${date}T00:00:00`).toISOString()
export const endOfDayIso = (date: string) => new Date(`${date}T23:59:59.999`).toISOString()
export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Display name for a provider league code, from the shared league config; unknown codes fall back to the raw code. */
export const leagueName = (code: string) => getLeagueConfig(code)?.name ?? code
