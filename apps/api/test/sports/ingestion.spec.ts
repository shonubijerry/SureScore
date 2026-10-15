import { describe, expect, it } from "vitest";
import type { FinalResult, FixturesQuery, MatchStatus, SportsEvent, SportsProvider } from "@surescore/shared";
import { invalidateStaleEvents, prefetchFixtures, refreshLiveScores } from "../../src/modules/sports/ingestion.js";
import type { SportsEventCacheRecord, SportsEventCacheStore } from "../../src/modules/sports/cache-repository.js";

class FakeSportsEventCacheStore implements SportsEventCacheStore {
	rows = new Map<string, SportsEventCacheRecord>();

	async upsertMany(events: SportsEventCacheRecord[]): Promise<void> {
		for (const event of events) {
			this.rows.set(`${event.provider}:${event.id}`, event);
		}
	}

	async listByStatus(status: MatchStatus, league?: string): Promise<SportsEventCacheRecord[]> {
		return [...this.rows.values()].filter((row) => row.status === status && (!league || row.league === league));
	}

	async listUpcoming(league?: string): Promise<SportsEventCacheRecord[]> {
		return this.listByStatus("scheduled", league);
	}

	async getById(id: string): Promise<SportsEventCacheRecord | null> {
		return this.rows.get(id) ?? null;
	}

	async listAll(): Promise<SportsEventCacheRecord[]> {
		return [...this.rows.values()];
	}

	async updateFreshness(id: string, freshness: SportsEventCacheRecord["freshness"]): Promise<void> {
		const row = this.rows.get(id);
		if (row) {
			this.rows.set(id, { ...row, freshness });
		}
	}
}

function makeEvent(overrides: Partial<SportsEvent> = {}): SportsEvent {
	return {
		id: "evt_1",
		provider: "espn",
		league: "eng.1",
		homeTeam: "Arsenal",
		awayTeam: "Chelsea",
		kickoffTimeUtc: "2026-09-27T15:00:00Z",
		status: "scheduled",
		homeScore: null,
		awayScore: null,
		isFinalResultOfficial: false,
		lastUpdatedUtc: "2026-09-24T00:00:00Z",
		...overrides,
	};
}

class FakeSportsProvider implements SportsProvider {
	readonly id = "espn";
	fixtureCalls = 0;

	constructor(
		private readonly fixtures: SportsEvent[] | Error = [],
		private readonly liveByLeague: Record<string, SportsEvent[] | Error> = {},
	) {}

	async getFixtures(_query?: FixturesQuery): Promise<SportsEvent[]> {
		this.fixtureCalls += 1;
		if (this.fixtures instanceof Error) throw this.fixtures;
		return this.fixtures;
	}

	async getLiveScores(league: string): Promise<SportsEvent[]> {
		const result = this.liveByLeague[league] ?? [];
		if (result instanceof Error) throw result;
		return result;
	}

	async getKickoffTime(_eventId: string): Promise<string> {
		return "2026-09-27T15:00:00Z";
	}

	async getStatus(_eventId: string): Promise<MatchStatus> {
		return "scheduled";
	}

	async getFinalResult(_eventId: string): Promise<FinalResult> {
		return { status: "finished", homeScore: 1, awayScore: 0, isFinalResultOfficial: true };
	}
}

describe("prefetchFixtures", () => {
	it("persists all fixtures returned by one provider call", async () => {
		const provider = new FakeSportsProvider([
			makeEvent({ id: "evt_1", league: "eng.1" }),
			makeEvent({ id: "evt_2", league: "esp.1", homeTeam: "Real Madrid", awayTeam: "Barcelona" }),
		]);
		const store = new FakeSportsEventCacheStore();

		const result = await prefetchFixtures(provider, store);

		expect(result.failures).toHaveLength(0);
		expect(result.refreshedEvents).toBe(2);
		expect(provider.fixtureCalls).toBe(1);
		expect(store.rows.get("espn:evt_1")).toMatchObject({ league: "eng.1", freshness: "cached" });
		expect(store.rows.get("espn:evt_2")).toMatchObject({ league: "esp.1", freshness: "cached" });
	});

	it("falls back to existing cached data when the provider fetch fails (T4.6)", async () => {
		const store = new FakeSportsEventCacheStore();
		await store.upsertMany([
			{ ...makeEvent({ id: "evt_1", league: "eng.1" }), freshness: "cached", lastRefreshedAt: "2026-09-24T00:00:00Z" },
		]);
		const provider = new FakeSportsProvider(new Error("ESPN is down"));

		const result = await prefetchFixtures(provider, store);

		expect(result.failures).toEqual([{ error: "ESPN is down" }]);
		// The previously cached row for eng.1 is untouched, not wiped out.
		expect(store.rows.get("espn:evt_1")).toBeDefined();
	});
});

describe("refreshLiveScores", () => {
	it("upserts live matches with 'live' freshness", async () => {
		const provider = new FakeSportsProvider(
			[],
			{ "eng.1": [makeEvent({ id: "evt_3", league: "eng.1", status: "live", homeScore: 1, awayScore: 0 })] },
		);
		const store = new FakeSportsEventCacheStore();

		await refreshLiveScores(provider, store);

		expect(store.rows.get("espn:evt_3")).toMatchObject({ status: "live", freshness: "live" });
	});
});

describe("invalidateStaleEvents", () => {
	it("marks a row stale once it has aged past the freshness tolerance", async () => {
		const store = new FakeSportsEventCacheStore();
		await store.upsertMany([
			{
				...makeEvent({ id: "evt_4", status: "live" }),
				freshness: "live",
				lastRefreshedAt: "2026-09-24T09:00:00Z",
			},
		]);

		const invalidatedCount = await invalidateStaleEvents(store, new Date("2026-09-24T12:00:00Z"));

		expect(invalidatedCount).toBe(1);
		expect(store.rows.get("espn:evt_4")).toMatchObject({ freshness: "stale" });
	});

	it("does not touch rows that are still within tolerance", async () => {
		const store = new FakeSportsEventCacheStore();
		await store.upsertMany([
			{
				...makeEvent({ id: "evt_5", status: "scheduled" }),
				freshness: "cached",
				lastRefreshedAt: "2026-09-24T10:00:00Z",
			},
		]);

		const invalidatedCount = await invalidateStaleEvents(store, new Date("2026-09-24T12:00:00Z"));

		expect(invalidatedCount).toBe(0);
	});
});
