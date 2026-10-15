import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { MATCH_RETENTION_DAYS, pruneOldMatches } from "../../src/modules/sports/cleanup";
import { applyMigrations } from "../helpers/db";


const db = createDbClient(env.DB);
const DAY = 86_400_000;
const now = new Date("2026-10-15T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);

beforeAll(async () => {
	await applyMigrations();
	await db.user.createMany({
		data: ["potter", "player"].map((id) => ({ id, email: `${id}@x.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG" })),
	});
});

async function match(id: string, kickoffTimeUtc: Date, status = "full time") {
	await db.sportsEventCache.create({
		data: { id: `espn:${id}`, provider: "espn", externalId: id, league: "eng.1", homeTeam: "H", awayTeam: "A", kickoffTimeUtc, status, lastRefreshedAt: daysAgo(30) },
	});
}

/** A pot with its creation transition and an optional funding ledger row. */
async function pot(id: string, matchId: string, status: string, fund?: "pending" | "failed" | "successful") {
	await db.pot.create({
		data: { id, potterId: "potter", eventId: `espn:${matchId}`, countryCode: "NG", currency: "NGN", provider: "paystack", prizeAmountMinorUnits: 10_000, winnerCount: 1, status },
	});
	await db.potStateTransition.create({ data: { potId: id, toStatus: "Draft", actorType: "user", reason: "created" } });
	if (fund) {
		await db.ledgerEntry.create({
			data: {
				entryKey: `fund:${id}:1`, idempotencyKey: `fund:${id}`, type: "fund", status: fund, userId: "potter", potId: id,
				countryCode: "NG", currency: "NGN", amountMinorUnits: 10_000, provider: "paystack",
			},
		});
	}
}

const exists = async (matchId: string) => (await db.sportsEventCache.findUnique({ where: { id: `espn:${matchId}` } })) !== null;
const potExists = async (id: string) => (await db.pot.findUnique({ where: { id } })) !== null;

describe("pruneOldMatches", () => {
	it(`removes matches ${MATCH_RETENTION_DAYS}+ days past kickoff unless a pot on them was paid for`, async () => {
		const old = daysAgo(MATCH_RETENTION_DAYS + 1);
		await match("no-pots", old);
		await match("dropped", old, "scheduled"); // fell off the provider feed
		await match("unpaid", old);
		await pot("draft-never-paid", "unpaid", "Cancelled", "pending");
		await pot("payment-failed", "unpaid", "Cancelled", "failed");

		await match("paid-refunded", old);
		await pot("refunded", "paid-refunded", "Refunded", "successful");
		await match("cancelled-after-funding", old);
		await pot("cancelled-funded", "cancelled-after-funding", "Cancelled", "successful");
		await match("mixed", old);
		await pot("mixed-paid", "mixed", "Paid", "successful");
		await pot("mixed-unpaid", "mixed", "Cancelled", "pending");

		await match("recent", daysAgo(MATCH_RETENTION_DAYS - 1));
		await match("upcoming", new Date(now.getTime() + DAY), "scheduled");

		expect(await pruneOldMatches(env.DB, now)).toEqual({ removedMatches: 3, removedPots: 2, keptForPaidPots: 3 });

		for (const gone of ["no-pots", "dropped", "unpaid"]) expect(await exists(gone)).toBe(false);
		for (const kept of ["paid-refunded", "cancelled-after-funding", "mixed", "recent", "upcoming"]) expect(await exists(kept)).toBe(true);

		// Unpaid pots go with their match (and their state history); a paid match keeps all its pots.
		expect(await potExists("draft-never-paid")).toBe(false);
		expect(await potExists("payment-failed")).toBe(false);
		expect(await db.potStateTransition.count({ where: { potId: { in: ["draft-never-paid", "payment-failed"] } } })).toBe(0);
		for (const kept of ["refunded", "cancelled-funded", "mixed-paid", "mixed-unpaid"]) expect(await potExists(kept)).toBe(true);

		// The ledger is append-only: the unpaid pots' funding attempts stay on record.
		expect(await db.ledgerEntry.count({ where: { potId: { in: ["draft-never-paid", "payment-failed"] } } })).toBe(2);

		// Re-running is a no-op.
		expect(await pruneOldMatches(env.DB, now)).toEqual({ removedMatches: 0, removedPots: 0, keptForPaidPots: 3 });
	});

	it("treats a pot as paid when its state proves funding, even without a ledger row", async () => {
		await match("state-only", daysAgo(MATCH_RETENTION_DAYS + 3));
		await pot("open-no-ledger", "state-only", "Open");
		await pruneOldMatches(env.DB, now);
		expect(await exists("state-only")).toBe(true);
	});
});
