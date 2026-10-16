// Store-agnostic contract for the sports event cache. Ingestion logic and
// route handlers depend only on this interface so they can be unit tested
// without a real D1/Prisma binding; `PrismaSportsEventCacheStore` below is
// the concrete adapter used at runtime.

import type { CacheFreshness, MatchStatus, SportsEvent } from '@surescore/shared'
import { createDbClient } from '@surescore/db'
import { paginate, type Page, type PageParams, type SortOrder } from '../../http/pagination.js'

export interface SportsEventCacheRecord extends SportsEvent {
	freshness: CacheFreshness
	lastRefreshedAt: string
}

export interface SportsEventCacheStore {
	upsertMany(events: SportsEventCacheRecord[]): Promise<void>
	listByStatus(status: MatchStatus, league?: string): Promise<SportsEventCacheRecord[]>
	getById(id: string): Promise<SportsEventCacheRecord | null>
	listAll(): Promise<SportsEventCacheRecord[]>
	updateFreshness(id: string, freshness: CacheFreshness): Promise<void>
}

function cacheId(record: Pick<SportsEventCacheRecord, 'provider' | 'id'>): string {
	return `${record.provider}:${record.id}`
}

export function toRecord(row: {
	id: string
	provider: string
	externalId: string
	league: string
	homeTeam: string
	awayTeam: string
	homeTeamId: string | null
	awayTeamId: string | null
	kickoffTimeUtc: Date
	status: string
	homeScore: number | null
	awayScore: number | null
	isFinalResultOfficial: boolean
	firstGoalMinute: number | null
	underdog: string | null
	importance: number
	freshness: string
	lastRefreshedAt: Date
}): SportsEventCacheRecord {
	return {
		id: row.externalId,
		provider: row.provider,
		league: row.league,
		homeTeam: row.homeTeam,
		awayTeam: row.awayTeam,
		homeTeamId: row.homeTeamId,
		awayTeamId: row.awayTeamId,
		kickoffTimeUtc: row.kickoffTimeUtc.toISOString(),
		status: row.status as MatchStatus,
		homeScore: row.homeScore,
		awayScore: row.awayScore,
		isFinalResultOfficial: row.isFinalResultOfficial,
		firstGoalMinute: row.firstGoalMinute,
		underdog: row.underdog as SportsEvent['underdog'],
		importance: row.importance,
		freshness: row.freshness as CacheFreshness,
		lastRefreshedAt: row.lastRefreshedAt.toISOString(),
		lastUpdatedUtc: row.lastRefreshedAt.toISOString(),
	}
}

export class PrismaSportsEventCacheStore implements SportsEventCacheStore {
	private readonly db: ReturnType<typeof createDbClient>

	constructor(database: D1Database) {
		this.db = createDbClient(database)
	}

	async upsertMany(events: SportsEventCacheRecord[]): Promise<void> {
		await Promise.all(
			events.map((event) => {
				const id = cacheId(event)
				const data = {
					provider: event.provider,
					externalId: event.id,
					league: event.league,
					homeTeam: event.homeTeam,
					awayTeam: event.awayTeam,
					homeTeamId: event.homeTeamId ?? undefined,
					awayTeamId: event.awayTeamId ?? undefined,
					kickoffTimeUtc: new Date(event.kickoffTimeUtc),
					status: event.status,
					homeScore: event.homeScore,
					awayScore: event.awayScore,
					isFinalResultOfficial: event.isFinalResultOfficial,
					// Odds disappear once a match starts and live feeds may omit goal
					// details, so a missing value must never erase one already cached.
					firstGoalMinute: event.firstGoalMinute ?? undefined,
					underdog: event.underdog ?? undefined,
					importance: event.importance ?? undefined,
					freshness: event.freshness,
					lastRefreshedAt: new Date(event.lastRefreshedAt),
				}
				return this.db.sportsEventCache.upsert({
					where: { id },
					create: { id, ...data },
					update: data,
				})
			}),
		)
	}

	async listByStatus(status: MatchStatus | MatchStatus[], league?: string): Promise<SportsEventCacheRecord[]> {
		const rows = await this.db.sportsEventCache.findMany({
			where: {
				status: {
					in: Array.isArray(status) ? status : [status],
				},
				...(league ? { league } : {}),
			},
			orderBy: { kickoffTimeUtc: 'asc' },
		})
		return rows.map(toRecord)
	}

	/** Matches in `statuses` by kickoff (soonest first, or latest first for `desc`), one keyset page at a time. */
	async listPage({
		statuses,
		league,
		order = 'asc',
		...page
	}: {
		statuses: readonly MatchStatus[]
		league?: string
		order?: 'asc' | 'desc'
	} & PageParams): Promise<Page<SportsEventCacheRecord>> {
		const sort: SortOrder = [
			{ path: 'kickoffTimeUtc', dir: order, type: 'date' },
			{ path: 'id', dir: order },
		]
		const where = { status: { in: [...statuses] }, ...(league ? { league } : {}) }
		const { items, nextCursor } = await paginate(sort, page, where, (args) => this.db.sportsEventCache.findMany(args))
		return { items: items.map(toRecord), nextCursor }
	}

	async getById(id: string): Promise<SportsEventCacheRecord | null> {
		const row = await this.db.sportsEventCache.findUnique({ where: { id } })
		return row ? toRecord(row) : null
	}

	async listAll(): Promise<SportsEventCacheRecord[]> {
		const rows = await this.db.sportsEventCache.findMany()
		return rows.map(toRecord)
	}

	async updateFreshness(id: string, freshness: CacheFreshness): Promise<void> {
		await this.db.sportsEventCache.update({ where: { id }, data: { freshness } })
	}
}
