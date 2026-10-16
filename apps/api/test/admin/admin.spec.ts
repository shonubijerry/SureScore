import { Hono } from "hono";
import { requireStaff, requirePermission } from "../../src/http/middleware";
import type { AppEnv } from "../../src/types";
import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDbClient } from "@surescore/db";
import { AdminPotService } from "../../src/modules/admin/pots";
import { AdminTransferService } from "../../src/modules/admin/transfers";
import { AdminOpsService } from "../../src/modules/admin/ops";
import { AdminUserService } from "../../src/modules/admin/users";
import { ReconciliationService } from "../../src/modules/payments/reconciliation-service";
import { trackJob } from "../../src/platform/job-runs";
import { PotService } from "../../src/modules/pots/pot-service";
import { applyMigrations } from "../helpers/db";


const send = vi.fn().mockResolvedValue(undefined);
const testEnv = { ...env, TRANSFER_QUEUE: { send, sendBatch: send } } as unknown as Env;
const db = createDbClient(env.DB);
const adminPots = new AdminPotService(testEnv);
const transfers = new AdminTransferService(testEnv, adminPots);
const kickoff = new Date(Date.now() + 86_400_000);

beforeAll(async () => {
	await applyMigrations();
});

async function seed(status: string, extra: { account?: boolean } = {}) {
	await db.ledgerEntry.deleteMany();
	await db.adminAuditLog.deleteMany();
	await db.settlementOverride.deleteMany();
	await db.potStateTransition.deleteMany();
	await db.prediction.deleteMany();
	await db.payoutAccount.deleteMany();
	await db.pot.deleteMany();
	await db.sportsEventCache.deleteMany();
	await db.user.deleteMany();
	const user = (id: string) => ({ id, email: `${id}@x.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG" });
	await db.user.createMany({ data: [user("potter"), user("u1"), user("u2")] });
	await db.sportsEventCache.create({
		data: {
			id: "espn:1", provider: "espn", externalId: "1", league: "eng.1", homeTeam: "A", awayTeam: "B",
			kickoffTimeUtc: kickoff, status: "second half", lastRefreshedAt: new Date(),
		},
	});
	await db.pot.create({
		data: {
			id: "p1", potterId: "potter", eventId: "espn:1", countryCode: "NG", currency: "NGN", provider: "paystack",
			prizeAmountMinorUnits: 10_000, winnerCount: 1, status, fundingReference: "fund-ref",
		},
	});
	await db.prediction.createMany({
		data: [
			{ potId: "p1", userId: "u1", homeGoals: 2, awayGoals: 1 },
			{ potId: "p1", userId: "u2", homeGoals: 0, awayGoals: 0 },
		],
	});
	if (extra.account) {
		await db.payoutAccount.create({
			data: { userId: "u1", countryCode: "NG", provider: "paystack", accountName: "U One", accountNumber: "0123456789", isDefault: true },
		});
	}
	send.mockClear();
}

const entry = (over: Record<string, unknown>) => ({
	entryKey: "k:1", idempotencyKey: "k", type: "payout", status: "failed", userId: "u1", potId: "p1",
	countryCode: "NG", currency: "NGN", amountMinorUnits: 9_000, provider: "paystack", ...over,
});

describe("admin pots", () => {
	beforeEach(() => seed("Settling"));

	it("summarises pots by state", async () => {
		expect(await adminPots.summary()).toEqual([{ status: "Settling", currency: "NGN", count: 1, prizeMinorUnits: 10_000 }]);
		expect((await adminPots.list({ status: "Settling", limit: 10 })).items).toHaveLength(1);
	});

	it("opens and resolves disputes with audit records, returning to the origin state", async () => {
		await adminPots.openDispute("admin", "p1", "player reports wrong score");
		expect((await db.pot.findUniqueOrThrow({ where: { id: "p1" } })).status).toBe("Disputed");
		await expect(adminPots.openDispute("admin", "p1", "again again")).rejects.toThrow();
		await adminPots.resolveDispute("admin", "p1", "score verified correct");
		expect((await db.pot.findUniqueOrThrow({ where: { id: "p1" } })).status).toBe("Settling");
		const detail = await adminPots.detail("p1");
		expect(detail.notes.map((n) => n.action).sort()).toEqual(["dispute.open", "dispute.resolve"]);
		expect(detail.transitions.map((t) => `${t.actorType}:${t.toStatus}`)).toEqual(["admin:Disputed", "admin:Settling"]);
	});

	it("settles on an override, once, and records the reason", async () => {
		await db.sportsEventCache.update({ where: { id: "espn:1" }, data: { status: "second half" } });
		const result = await adminPots.overrideSettlement("admin", "p1", { homeGoals: 2, awayGoals: 1, reason: "provider stuck at 1-1" });
		expect(result.settled).toBe(true);
		expect((await db.pot.findUniqueOrThrow({ where: { id: "p1" } })).status).toBe("Paid");
		// Winner (u1) had no payout account: surfaces as a failed payout, not a lost one.
		const rows = await db.ledgerEntry.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ userId: "u1", status: "failed", amountMinorUnits: 9_000 });
		await expect(adminPots.overrideSettlement("admin", "p1", { homeGoals: 0, awayGoals: 0, reason: "second try" })).rejects.toThrow();
		expect((await db.adminAuditLog.findMany({ where: { action: "settlement.override" } }))[0].reason).toBe("provider stuck at 1-1");
	});

	it("shows the result, prize split and winners with their picks, points breakdown and payout state", async () => {
		await db.sportsEventCache.update({ where: { id: "espn:1" }, data: { homeScore: 1, awayScore: 1 } });
		// Live score: a provisional ranking (u2's 0-0 beats u1's 2-1 on a 1-1).
		let detail = await adminPots.detail("p1");
		expect(detail.result).toEqual({ homeGoals: 1, awayGoals: 1, firstGoalMinute: null, final: false, source: "provider" });
		expect(detail.winners.map((w) => w.userId)).toEqual(["u2"]);

		await adminPots.overrideSettlement("admin", "p1", { homeGoals: 2, awayGoals: 1, reason: "provider stuck at 1-1" });
		detail = await adminPots.detail("p1");
		expect(detail.result).toMatchObject({ homeGoals: 2, awayGoals: 1, final: true, source: "override" });
		expect(detail.prize).toEqual({ winnerPool: 9_000, platformFee: 1_000, winnerCount: 1 });
		expect(detail.winners).toHaveLength(1);
		const [winner] = detail.winners;
		expect(winner).toMatchObject({
			rank: 1,
			userId: "u1",
			email: "u1@x.com",
			prediction: { homeGoals: 2, awayGoals: 1 },
			prizeMinorUnits: 9_000,
			// The settled payout is the same amount the detail computes.
			payout: { status: "failed", amountMinorUnits: 9_000, detail: "No payout account on file" },
		});
		expect(winner.breakdown.total).toBeGreaterThan(0);
		expect(winner.breakdown.exactScoreline).toBeGreaterThan(0);
	});

	it("refuses overrides for pots whose payouts already went out", async () => {
		await db.pot.update({ where: { id: "p1" }, data: { status: "Paid" } });
		await adminPots.openDispute("admin", "p1", "paid but contested");
		await expect(adminPots.overrideSettlement("admin", "p1", { homeGoals: 1, awayGoals: 0, reason: "too late" })).rejects.toThrow(/already issued/);
	});
});

describe("admin transfers", () => {
	beforeEach(() => seed("Paid"));

	it("lists failed payouts and marks them ready once the user adds an account", async () => {
		await db.ledgerEntry.create({ data: entry({ entryKey: "payout:p1:u1:0", idempotencyKey: "payout:p1:u1", detail: "No payout account on file" }) });
		let queue = await transfers.queue({ type: "payout", status: "failed" });
		expect(queue.items).toHaveLength(1);
		expect(queue.items[0]).toMatchObject({ hasPayoutAccount: false, readyToRetry: false, email: "u1@x.com" });

		await expect(transfers.retry("admin", "payout:p1:u1", "details updated")).rejects.toThrow(/no payout account/i);

		await db.payoutAccount.create({
			data: { userId: "u1", countryCode: "NG", provider: "paystack", accountName: "U One", accountNumber: "0123456789", isDefault: true },
		});
		queue = await transfers.queue({ type: "payout", status: "failed" });
		expect(queue.items[0].readyToRetry).toBe(true);

		await transfers.retry("admin", "payout:p1:u1", "details updated");
		expect(send).toHaveBeenCalledOnce();
		expect(send.mock.calls[0][0]).toMatchObject({ type: "payout", attemptOffset: 1, request: { userId: "u1", amountMinorUnits: 9_000 } });
		expect(await db.adminAuditLog.count({ where: { action: "transfer.retry" } })).toBe(1);
	});

	it("drops actions from the failed queue once a later attempt succeeds, and rejects retrying them", async () => {
		await db.ledgerEntry.createMany({
			data: [
				entry({ entryKey: "payout:p1:u1:1", idempotencyKey: "payout:p1:u1" }),
				entry({ entryKey: "payout:p1:u1:2", idempotencyKey: "payout:p1:u1", status: "successful" }),
			],
		});
		expect((await transfers.queue({ type: "payout", status: "failed" })).items).toEqual([]);
		expect((await transfers.queue({ type: "payout", status: "successful" })).items).toHaveLength(1);
		await expect(transfers.retry("admin", "payout:p1:u1", "retry please")).rejects.toThrow(/Only failed/);
	});

	it("lists every action once by default, at its latest state, even across pages", async () => {
		await db.ledgerEntry.createMany({
			data: [
				entry({ entryKey: "payout:p1:u1:1", idempotencyKey: "payout:p1:u1", createdAt: new Date(1_000) }),
				entry({ entryKey: "payout:p1:u1:2", idempotencyKey: "payout:p1:u1", status: "successful", createdAt: new Date(2_000) }),
			],
		});
		const all = await transfers.queue({ type: "payout" });
		expect(all.items).toMatchObject([{ idempotencyKey: "payout:p1:u1", status: "successful", attempts: 2 }]);

		const first = await transfers.queue({ type: "payout", limit: 1 });
		expect(first.items).toHaveLength(1);
		const second = await transfers.queue({ type: "payout", limit: 1, cursor: first.nextCursor! });
		expect(second.items).toEqual([]);
	});

	it("filters payouts to one user", async () => {
		await db.ledgerEntry.createMany({
			data: [
				entry({ entryKey: "payout:p1:u1:0", idempotencyKey: "payout:p1:u1" }),
				entry({ entryKey: "payout:p1:u2:0", idempotencyKey: "payout:p1:u2", userId: "u2" }),
			],
		});
		expect((await transfers.queue({ type: "payout" })).items).toHaveLength(2);
		expect((await transfers.queue({ type: "payout", userId: "u2" })).items.map((t) => t.userId)).toEqual(["u2"]);
	});

	it("retries a failed refund only for a cancelled pot", async () => {
		await db.ledgerEntry.create({
			data: entry({ entryKey: "refund:p1:1", idempotencyKey: "refund:p1", type: "refund", userId: "potter", amountMinorUnits: 10_000 }),
		});
		await expect(transfers.retry("admin", "refund:p1", "retry refund")).rejects.toThrow(/Cannot refund/);
		await db.pot.update({ where: { id: "p1" }, data: { status: "Cancelled" } });
		await transfers.retry("admin", "refund:p1", "retry refund");
		expect(send.mock.calls[0][0]).toMatchObject({ type: "refund", attemptOffset: 2, request: { idempotencyKey: "refund:p1", originalReference: "fund-ref" } });
	});
});

describe("ops views and reconciliation", () => {
	beforeEach(() => seed("Paid", { account: true }));

	it("searches the ledger by reference, user email and filters, with pagination", async () => {
		await db.ledgerEntry.createMany({
			data: [
				entry({ entryKey: "a:1", idempotencyKey: "a", reference: "REF-A", status: "successful" }),
				entry({ entryKey: "b:1", idempotencyKey: "b", reference: "REF-B" }),
			],
		});
		const ops = new AdminOpsService(env.DB);
		expect((await ops.searchLedger({ q: "REF-A", limit: 10 })).items.map((e) => e.idempotencyKey)).toEqual(["a"]);
		expect((await ops.searchLedger({ q: "U1@X.com", limit: 10 })).items).toHaveLength(2);
		expect((await ops.searchLedger({ status: "failed", limit: 10 })).items.map((e) => e.idempotencyKey)).toEqual(["b"]);
		const first = await ops.searchLedger({ limit: 1 });
		expect(first.nextCursor).not.toBeNull();
		const second = await ops.searchLedger({ limit: 1, cursor: first.nextCursor! });
		expect(second.items[0].id).not.toBe(first.items[0].id);
	});

	it("reports job failures and provider health", async () => {
		await trackJob(env.DB, "live-refresh", "sports", async () => ({ failures: [{ error: "espn 503" }] }));
		await trackJob(env.DB, "settlement", "payments", async () => undefined);
		await db.ledgerEntry.create({ data: entry({ detail: "bank rejected" }) });
		const health = await new AdminOpsService(env.DB).health();
		expect(health.recentFailures[0]).toMatchObject({ job: "live-refresh", error: "espn 503" });
		expect(health.jobs.find((j) => j.job === "live-refresh")?.failures24h).toBe(1);
		expect(health.payments[0]).toMatchObject({ provider: "paystack", failed24h: 1, lastFailureDetail: "bank rejected" });
		expect(health.sports[0].provider).toBe("espn");
	});

	it("flags fraud-like ledger states once and lets admins review them", async () => {
		await db.pot.update({ where: { id: "p1" }, data: { updatedAt: new Date(Date.now() - 3 * 3_600_000) } });
		await db.ledgerEntry.createMany({
			data: [
				entry({ entryKey: "payout:p1:ghost:1", idempotencyKey: "payout:p1:ghost", status: "successful", userId: "u2", amountMinorUnits: 9_500 }),
			],
		});
		const recon = new ReconciliationService(env.DB, adminPots);
		const first = await recon.run();
		expect(first.newFindings).toBeGreaterThan(0);
		const { items } = await recon.findings({ status: "open", limit: 50 });
		const codes = items.map((f) => f.code);
		expect(codes).toEqual(expect.arrayContaining(["FUND_MISSING", "PAYOUT_EXCEEDS_POOL"]));

		expect((await recon.run()).newFindings).toBe(0);
		await recon.resolve("admin", items[0].id, "investigated with finance");
		expect((await recon.latest()).open).not.toEqual({});
		await expect(recon.resolve("admin", items[0].id, "twice twice")).rejects.toThrow();
	});
});

describe("admin users", () => {
	beforeEach(() => seed("Paid", { account: true }));
	const users = new AdminUserService(env.DB);

	it("lists every account newest first, searchable, one keyset page at a time", async () => {
		const all = await users.list({});
		expect(all.items.map((u) => u.id).sort()).toEqual(["potter", "u1", "u2"]);
		expect(all.items[0]).not.toHaveProperty("passwordHash");
		expect((await users.list({ q: "U2@x" })).items.map((u) => u.id)).toEqual(["u2"]);
		expect((await users.list({ q: "u1" })).items.map((u) => u.id)).toEqual(["u1"]);
		expect((await users.list({ roles: ["admin"] })).items).toEqual([]);

		const first = await users.list({ limit: 2 });
		const second = await users.list({ limit: 2, cursor: first.nextCursor! });
		expect([...first.items, ...second.items].map((u) => u.id).sort()).toEqual(["potter", "u1", "u2"]);
		expect(second.nextCursor).toBeNull();
	});

	it("shows a user's masked payout accounts, activity and settled totals", async () => {
		await db.ledgerEntry.create({ data: entry({ entryKey: "payout:p1:u1:1", idempotencyKey: "payout:p1:u1", status: "successful" }) });
		const detail = await users.detail("u1");
		expect(detail.user).toMatchObject({ id: "u1", email: "u1@x.com" });
		expect(detail.payoutAccounts).toHaveLength(1);
		expect(detail.payoutAccounts[0].accountNumber).toMatch(/^••••/);
		expect(detail.stats).toEqual({ potsCreated: 0, predictions: 1 });
		expect(detail.totals).toEqual([{ type: "payout", currency: "NGN", amountMinorUnits: 9_000 }]);
		await expect(users.detail("nobody")).rejects.toThrow(/not found/i);
	});
});

describe("PotService.refundJob", () => {
	const pot = { id: "p", potterId: "u", countryCode: "NG", currency: "NGN", prizeAmountMinorUnits: 10_000, fundingReference: null } as never;

	it("uses the stable refund idempotency key", () => {
		expect(PotService.refundJob(pot, "cancelled").request.idempotencyKey).toBe("refund:p");
	});

	it("refunds the full prize unless the pot closed with no winner, which keeps the 10% fee", () => {
		expect(PotService.refundJob(pot, "cancelled").request.amountMinorUnits).toBe(10_000);
		expect(PotService.refundJob(pot, "postponed").request.amountMinorUnits).toBe(10_000);
		expect(PotService.refundJob(pot, "no-winner", "acct").request).toMatchObject({ amountMinorUnits: 9_000, payoutAccountId: "acct" });
	});
});

describe("role guards", () => {
	it("lets staff view but not act, and admins do both", async () => {
		await seed("Paid");
		await db.user.update({ where: { id: "potter" }, data: { role: "admin" } });
		await db.user.update({ where: { id: "u1" }, data: { role: "staff" } });
		const call = async (userId: string, permission: "pots.view" | "pots.override") => {
			const app = new Hono<AppEnv>();
			app.use("*", async (c, next) => (c.set("userId", userId), next()));
			app.use("*", requireStaff, requirePermission(permission));
			app.get("/", (c) => c.text("ok"));
			return (await app.request("/", {}, env)).status;
		};
		expect(await call("potter", "pots.override")).toBe(200);
		expect(await call("u1", "pots.view")).toBe(200);
		expect(await call("u1", "pots.override")).toBe(403);
		expect(await call("missing", "pots.view")).toBe(403);
	});
});
