// ESPN soccer schedule/scoreboard adapter. All ESPN-specific response shapes and
// endpoints are isolated here; nothing outside this file may know that
// "ESPN" exists. Only the internal `SportsProvider` contract and the
// normalized `SportsEvent` schema are exposed.
//
// Site API endpoint: https://site.api.espn.com/apis/site/v2/sports/soccer/:league/scoreboard

import { getSportsProviderConfig } from '@surescore/shared'
import type { FinalResult, FixturesQuery, MatchStatus, SportsEvent, SportsProvider } from '@surescore/shared'

export interface EspnSportsProviderConfig {
	baseUrl?: string
	fetchImpl?: typeof fetch
}

interface EspnCompetitor {
	homeAway: 'home' | 'away'
	team: { displayName: string }
	score?: string
}

interface EspnStatusType {
	name: string // e.g. STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL, STATUS_POSTPONED, STATUS_CANCELED
	completed: boolean
	description: string // e.g. "Scheduled", "In Progress", "Full Time", "Postponed", "Canceled"
}

interface EspnCompetition {
	id: string
	date: string
	status: { type: EspnStatusType }
	competitors: EspnCompetitor[]
	details?: EspnDetail[]
	odds?: (EspnOdds | null)[]
	broadcasts?: unknown[]
	geoBroadcasts?: unknown[]
}

interface EspnDetail {
	scoringPlay?: boolean
	shootout?: boolean
	clock?: { value?: number }
}

type EspnPrice = { close?: { odds?: string }; open?: { odds?: string } }
interface EspnOdds {
	moneyline?: { home?: EspnPrice; away?: EspnPrice }
}

interface EspnEvent {
	id: string
	date: string
	competitions: EspnCompetition[]
}

interface EspnScoreboardResponse {
	events: EspnEvent[]
}

function toInternalStatus(espnStatusDescription: string) {
	return espnStatusDescription.toLowerCase() as MatchStatus
}

function toScore(value: string | undefined): number | null {
	if (value === undefined || value === '') {
		return null
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

const REGULATION_SECONDS = 90 * 60

/** Earliest regulation-time goal, rounded up to match ESPN's own minute display. */
function toFirstGoalMinute(details: EspnDetail[] = []): number | null {
	const seconds = details
		.filter((d) => d.scoringPlay && !d.shootout && typeof d.clock?.value === 'number' && d.clock.value <= REGULATION_SECONDS)
		.map((d) => d.clock?.value as number)
	return seconds.length ? Math.max(1, Math.ceil(Math.min(...seconds) / 60)) : null
}

/** ESPN exposes no explicit "important match" flag; the number of broadcast listings is the best prominence signal it gives. */
function toImportance(competition?: EspnCompetition): number | undefined {
	if (!competition?.broadcasts && !competition?.geoBroadcasts) return undefined
	return (competition.broadcasts?.length ?? 0) + (competition.geoBroadcasts?.length ?? 0)
}

/** The side with the longer American moneyline price is the underdog; level prices have none. */
function toUnderdog(odds: (EspnOdds | null)[] = []): 'home' | 'away' | null {
	const moneyline = odds.find((o) => o?.moneyline)?.moneyline
	const price = (side?: EspnPrice) => Number(side?.close?.odds ?? side?.open?.odds)
	const home = price(moneyline?.home)
	const away = price(moneyline?.away)
	if (!Number.isFinite(home) || !Number.isFinite(away) || home === away) return null
	return home > away ? 'home' : 'away'
}

function toUtcDate(value: string | undefined, fallback: Date): Date {
	const date = value === undefined ? fallback : new Date(value)
	if (!Number.isFinite(date.getTime())) {
		throw new Error(`Invalid fixtures date: "${value}"`)
	}
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function toEspnDate(date: Date): string {
	return date.toISOString().slice(0, 10).replaceAll('-', '')
}

function normalizeEvent(league: string, event: EspnEvent): SportsEvent {
	const competition = event.competitions[0]
	const home = competition?.competitors.find((competitor) => competitor.homeAway === 'home')
	const away = competition?.competitors.find((competitor) => competitor.homeAway === 'away')
	const status = toInternalStatus(competition?.status.type.description ?? '')

	return {
		id: event.id,
		provider: 'espn',
		league,
		homeTeam: home?.team.displayName ?? 'Unknown',
		awayTeam: away?.team.displayName ?? 'Unknown',
		kickoffTimeUtc: event.date,
		status,
		homeScore: toScore(home?.score),
		awayScore: toScore(away?.score),
		// ESPN's default competitor score reflects 90 minutes + stoppage time for
		// soccer; extra time/penalty shootout outcomes are reported separately
		// and are never folded into this field, so "finished" here is always the
		// regulation-time result.
		isFinalResultOfficial: status === 'full time',
		firstGoalMinute: toFirstGoalMinute(competition?.details),
		underdog: toUnderdog(competition?.odds),
		importance: toImportance(competition),
		lastUpdatedUtc: new Date().toISOString(),
	}
}

export class EspnSportsProvider implements SportsProvider {
	readonly id = 'espn'

	private readonly baseUrl: string
	private readonly fetchImpl: typeof fetch

	constructor(config: EspnSportsProviderConfig = {}) {
		this.baseUrl = config.baseUrl ?? 'https://site.web.api.espn.com/apis/site/v2/sports/soccer'
		// Bind to globalThis: workerd's fetch requires its original `this`, which
		// an unbound function reference loses ("Illegal invocation").
		this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis)
	}

	private async fetchScoreboard(league: string, date?: Date): Promise<SportsEvent[]> {
		const url = new URL(`${this.baseUrl}/${league}/scoreboard`)
		if (date) {
			url.searchParams.set('dates', toEspnDate(date))
		}
		const response = await this.fetchImpl(url.toString())
		if (!response.ok) {
			throw new Error(`ESPN scoreboard request for league "${league}" failed: ${response.statusText}`)
		}
		const body = (await response.json()) as EspnScoreboardResponse
		return body.events.map((event) => normalizeEvent(league, event))
	}

	async getFixtures(query?: FixturesQuery): Promise<SportsEvent[]> {
		const today = new Date()
		const from = toUtcDate(query?.from, today)
		const defaultTo = new Date(from)
		defaultTo.setUTCDate(defaultTo.getUTCDate() + 6)
		const to = toUtcDate(query?.to, defaultTo)
		if (to < from) {
			throw new Error('Fixtures end date must not be before start date')
		}

		const leagues = getSportsProviderConfig(this.id)?.leagues ?? []
		const events: SportsEvent[] = []
		for (const league of leagues) {
			for (const date = new Date(from); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
				events.push(...(await this.fetchScoreboard(league, date)))
			}
		}
		return events
	}

	async getLiveScores(league: string): Promise<SportsEvent[]> {
		const events = await this.fetchScoreboard(league)
		return events.filter((event) => ['first half', 'second half', 'half time'].includes(event.status))
	}

	async getKickoffTime(eventId: string): Promise<string> {
		const event = await this.findEvent(eventId)
		return event.kickoffTimeUtc
	}

	async getStatus(eventId: string): Promise<MatchStatus> {
		const event = await this.findEvent(eventId)
		return event.status
	}

	async getFinalResult(eventId: string): Promise<FinalResult> {
		const event = await this.findEvent(eventId)
		return {
			status: event.status,
			homeScore: event.homeScore,
			awayScore: event.awayScore,
			isFinalResultOfficial: event.isFinalResultOfficial,
		}
	}

	/** ESPN's scoreboard is not queryable by event id directly, so we scan the configured leagues. */
	private async findEvent(eventId: string): Promise<SportsEvent> {
		const leagues = getSportsProviderConfig(this.id)?.leagues ?? []
		for (const league of leagues) {
			const events = await this.fetchScoreboard(league)
			const match = events.find((event) => event.id === eventId)
			if (match) {
				return match
			}
		}
		throw new Error(`No ESPN event found for id "${eventId}"`)
	}
}
