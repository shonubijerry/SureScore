import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { PAGE_FETCH_LIMIT } from "@surescore/shared";
import {
	PAGE_MAX,
	decodeCursor,
	encodeCursor,
	keysetArgs,
	newestFirst,
	paginate,
	paginateArray,
	toPage,
	type SortOrder,
} from "../../src/http/pagination";
import { applyMigrations } from "../helpers/db";

beforeAll(applyMigrations);

const byKickoff: SortOrder = [
	{ path: "event.kickoffTimeUtc", dir: "asc", type: "date" },
	{ path: "id", dir: "asc" },
];

describe("keyset pagination", () => {
	it("defaults to the shared 1000-row batch", () => {
		expect(PAGE_MAX).toBe(PAGE_FETCH_LIMIT);
		expect(keysetArgs(newestFirst, {}, {}).take).toBe(1001);
		expect(keysetArgs(newestFirst, { limit: 5000 }, {}).take).toBe(1001);
	});

	it("round-trips cursor values, reviving dates", () => {
		const at = new Date("2026-10-15T12:00:00.000Z");
		const cursor = encodeCursor([at, "c1"]);
		expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeCursor(cursor, newestFirst)).toEqual([at, "c1"]);
	});

	it("rejects malformed or mismatched cursors with a 400", () => {
		expect(() => decodeCursor("not-json", newestFirst)).toThrow(/Invalid cursor/);
		expect(() => decodeCursor(encodeCursor(["c1"]), newestFirst)).toThrow(/Invalid cursor/);
		expect(() => decodeCursor(encodeCursor(["yesterday", "c1"]), newestFirst)).toThrow(/Invalid cursor/);
	});

	it("filters by range on the sort keys instead of skipping rows, across relations", () => {
		const at = new Date("2026-10-15T12:00:00.000Z");
		const args = keysetArgs(byKickoff, { cursor: encodeCursor([at, "p9"]), limit: 2 }, { status: "Open" });
		expect(args).toMatchObject({ take: 3, orderBy: [{ event: { kickoffTimeUtc: "asc" } }, { id: "asc" }] });
		expect(args).not.toHaveProperty("skip");
		expect(args.where).toEqual({
			AND: [
				{ status: "Open" },
				{
					OR: [
						{ AND: [{ event: { kickoffTimeUtc: { gt: at } } }] },
						{ AND: [{ event: { kickoffTimeUtc: at } }, { id: { gt: "p9" } }] },
					],
				},
			],
		});
	});

	it("reports a cursor (built from the last row's keys) only when more rows exist", () => {
		const rows = [1, 2, 3, 4].map((n) => ({ id: `r${n}`, event: { kickoffTimeUtc: new Date(n * 1000) } }));
		const page = toPage(rows, byKickoff, 3);
		expect(page.items).toEqual(rows.slice(0, 3));
		expect(decodeCursor(page.nextCursor!, byKickoff)).toEqual([new Date(3000), "r3"]);
		expect(toPage(rows.slice(0, 3), byKickoff, 3).nextCursor).toBeNull();
	});

	it("pages an in-memory sorted set with the same cursors", () => {
		const rows = [1, 1, 2, 3, 3].map((n, i) => ({ id: `r${i}`, event: { kickoffTimeUtc: new Date(n * 1000) } }));
		const seen: string[] = [];
		let cursor: string | undefined;
		do {
			const page = paginateArray(rows, byKickoff, { limit: 2, cursor });
			seen.push(...page.items.map((r) => r.id));
			cursor = page.nextCursor ?? undefined;
		} while (cursor);
		expect(seen).toEqual(["r0", "r1", "r2", "r3", "r4"]);
	});
});

describe("keyset pagination on D1", () => {
	const db = createDbClient(env.DB);

	beforeAll(async () => {
		// Many rows share a timestamp, so pages must split ties on id without repeating or dropping rows.
		const at = [new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")];
		await db.user.createMany({
			data: Array.from({ length: 23 }, (_, i) => ({
				id: `u${String(i).padStart(2, "0")}`,
				email: `u${i}@x.com`,
				passwordHash: "h",
				passwordSalt: "s",
				countryCode: i % 2 ? "NG" : "GH",
				createdAt: at[i % 2],
			})),
		});
	});

	async function readAll(where: object, limit: number) {
		const ids: string[] = [];
		let cursor: string | undefined;
		let pages = 0;
		do {
			const page = await paginate(newestFirst, { limit, cursor }, where, (args) => db.user.findMany({ ...args, select: { id: true, createdAt: true } }));
			ids.push(...page.items.map((u) => u.id));
			cursor = page.nextCursor ?? undefined;
			pages++;
		} while (cursor);
		return { ids, pages };
	}

	it("walks every row exactly once, newest first, through timestamp ties", async () => {
		const expected = (await db.user.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } })).map((u) => u.id);
		const { ids, pages } = await readAll({}, 5);
		expect(ids).toEqual(expected);
		expect(pages).toBe(5);
	});

	it("keeps the caller's filter on every page", async () => {
		const { ids } = await readAll({ countryCode: "NG" }, 4);
		expect(ids).toHaveLength(11);
		expect(new Set(ids).size).toBe(11);
	});
});

describe("keyset pagination across a relation on D1", () => {
	const db = createDbClient(env.DB);
	// The discovery order: soonest kickoff, newest pot within a match, id last (mixed directions).
	const discovery: SortOrder = [
		{ path: "event.kickoffTimeUtc", dir: "asc", type: "date" },
		{ path: "createdAt", dir: "desc", type: "date" },
		{ path: "id", dir: "asc" },
	];

	beforeAll(async () => {
		await db.user.create({ data: { id: "potter", email: "potter@x.com", passwordHash: "h", passwordSalt: "s", countryCode: "NG" } });
		const kickoffs = [3, 1, 2].map((d) => new Date(Date.UTC(2026, 11, d)));
		await db.sportsEventCache.createMany({
			data: kickoffs.map((kickoffTimeUtc, i) => ({
				id: `espn:${i}`, provider: "espn", externalId: String(i), league: "eng.1", homeTeam: "A", awayTeam: "B",
				kickoffTimeUtc, status: "scheduled", lastRefreshedAt: new Date(),
			})),
		});
		const created = [new Date("2026-10-01T00:00:00.000Z"), new Date("2026-10-02T00:00:00.000Z")];
		await db.pot.createMany({
			data: Array.from({ length: 14 }, (_, i) => ({
				id: `pot${String(i).padStart(2, "0")}`, potterId: "potter", eventId: `espn:${i % 3}`, countryCode: "NG", currency: "NGN",
				provider: "paystack", prizeAmountMinorUnits: 1000, winnerCount: 1, status: "Open", createdAt: created[i % 2],
			})),
		});
	});

	it("walks every pot exactly once in discovery order", async () => {
		const expected = await db.pot.findMany({
			orderBy: [{ event: { kickoffTimeUtc: "asc" } }, { createdAt: "desc" }, { id: "asc" }],
			select: { id: true },
		});
		const ids: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await paginate(discovery, { limit: 3, cursor }, { status: "Open" }, (args) =>
				db.pot.findMany({ ...args, include: { event: { select: { kickoffTimeUtc: true } } } }),
			);
			ids.push(...page.items.map((p) => p.id));
			cursor = page.nextCursor ?? undefined;
		} while (cursor);
		expect(ids).toEqual(expected.map((p) => p.id));
	});
});
