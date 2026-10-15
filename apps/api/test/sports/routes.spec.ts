import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { applyMigrations } from "../helpers/db";

const db = createDbClient(env.DB);
beforeAll(applyMigrations);

describe("match listing routes", () => {
	const fetchJson = async <T,>(path: string) => {
		const { default: app } = await import("../../src/index");
		const res = await app.fetch(new Request(`http://x${path}`), env, { waitUntil() {}, passThroughOnException() {} } as never);
		return (await res.json()) as T;
	};
	type MatchPage = { matches: { id: string; status: string; homeScore: number | null }[]; nextCursor: string | null };
	const pageIds = (page: MatchPage) => page.matches.map((m) => m.id);

	it("picks the most important upcoming matches and pages through them by kickoff date", async () => {
		await db.sportsEventCache.deleteMany();
		const base = { provider: "espn", league: "t", homeTeam: "H", awayTeam: "A", status: "scheduled", lastRefreshedAt: new Date() };
		const at = (h: number) => new Date(Date.now() + h * 3_600_000);
		// p0 kicks off first but is the least important of 21, so it misses the top 20.
		await db.sportsEventCache.createMany({
			data: Array.from({ length: 21 }, (_, i) => ({
				...base,
				id: `espn:p${i}`,
				externalId: `p${i}`,
				kickoffTimeUtc: at(i === 0 ? 1 : 50 - i),
				importance: i,
				homeScore: 0,
				awayScore: 0,
			})),
		});
		const byDate = Array.from({ length: 20 }, (_, i) => `p${20 - i}`);
		const first = await fetchJson<MatchPage>("/api/discover/matches/popular?limit=4");
		expect(pageIds(first)).toEqual(byDate.slice(0, 4));
		// Providers report 0-0 before kickoff; unplayed matches expose no score.
		expect(first.matches.every((m) => m.homeScore === null)).toBe(true);

		const seen = [...pageIds(first)];
		for (let cursor = first.nextCursor; cursor; ) {
			const page = await fetchJson<MatchPage>(`/api/discover/matches/popular?limit=4&cursor=${encodeURIComponent(cursor)}`);
			seen.push(...pageIds(page));
			cursor = page.nextCursor;
		}
		expect(seen).toEqual(byDate);
	});

	it("pages live matches and lists results newest first, filtered by league", async () => {
		await db.sportsEventCache.deleteMany();
		const base = { provider: "espn", homeTeam: "H", awayTeam: "A", lastRefreshedAt: new Date(), homeScore: 1, awayScore: 0 };
		const at = (h: number) => new Date(Date.now() + h * 3_600_000);
		await db.sportsEventCache.createMany({
			data: [
				...Array.from({ length: 5 }, (_, i) => ({ ...base, id: `espn:l${i}`, externalId: `l${i}`, league: "eng.1", status: "second half", kickoffTimeUtc: at(-1 - i / 10) })),
				{ ...base, id: "espn:r1", externalId: "r1", league: "eng.1", status: "full time", kickoffTimeUtc: at(-48) },
				{ ...base, id: "espn:r2", externalId: "r2", league: "eng.1", status: "full time", kickoffTimeUtc: at(-24) },
				{ ...base, id: "espn:r3", externalId: "r3", league: "esp.1", status: "full time", kickoffTimeUtc: at(-12) },
			],
		});
		const live = await fetchJson<MatchPage>("/api/sports/matches/live?limit=4");
		expect(pageIds(live)).toEqual(["l4", "l3", "l2", "l1"]);
		const more = await fetchJson<MatchPage>(`/api/sports/matches/live?limit=4&cursor=${live.nextCursor}`);
		expect([pageIds(more), more.nextCursor]).toEqual([["l0"], null]);
		expect(live.matches[0].homeScore).toBe(1);

		expect(pageIds(await fetchJson<MatchPage>("/api/sports/matches/results?league=eng.1"))).toEqual(["r2", "r1"]);
		expect(pageIds(await fetchJson<MatchPage>("/api/sports/matches/results"))).toEqual(["r3", "r2", "r1"]);
	});

	it("lists the provider's leagues with light and dark logos", async () => {
		const { provider, leagues } = await fetchJson<{ provider: string; leagues: { code: string; name: string; logoUrl: string; darkLogoUrl: string }[] }>(
			"/api/sports/leagues?countryCode=NG",
		);
		expect(provider).toBe("espn");
		expect(leagues[0]).toEqual({
			code: "eng.1",
			name: "Premier League",
			logoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
			darkLogoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/23.png",
		});
		expect(leagues.every((l) => l.logoUrl.startsWith("https://a.espncdn.com/") && l.darkLogoUrl.includes("500-dark"))).toBe(true);
	});
});
