// End-to-end (T11.3): signup -> create pot -> fund -> predict -> settle -> payout,
// through the real Hono app, D1 and queue consumer. Only Paystack's HTTP is faked.
import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDbClient } from "@surescore/db";
import app from "../src/router";
import { PotService } from "../src/lib/pot-service";
import { SettlementService } from "../src/lib/settlement-service";
import { handleTransferBatch, type TransferJob } from "../src/lib/transfer-queue";

const migrations = (import.meta as unknown as { glob: (p: string, o: object) => unknown }).glob("../../../packages/db/prisma/migrations/*/migration.sql", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const queued: TransferJob[] = [];
const send = vi.fn(async (job: TransferJob) => void queued.push(job));
const testEnv = {
	...env,
	TRANSFER_QUEUE: { send, sendBatch: async (jobs: { body: TransferJob }[]) => jobs.forEach((j) => queued.push(j.body)) },
} as unknown as Env;
const db = createDbClient(env.DB);

const paystack = vi.fn(async (url: string | URL | Request) => {
	const path = String(url).replace("https://api.paystack.co", "");
	const data = path.startsWith("/transaction/initialize")
		? { reference: "fund-ref", status: "pending", authorization_url: "https://pay.test/x" }
		: path.startsWith("/transaction/verify")
			? { reference: "fund-ref", status: "success", amount: 10_000, currency: "NGN" }
			: path.startsWith("/transferrecipient")
				? { recipient_code: "RCP_test" }
				: { reference: "tr-1", status: "success", amount: 9_000, currency: "NGN" };
	return new Response(JSON.stringify({ status: true, message: "ok", data }), { status: 200 });
});

beforeAll(async () => {
	vi.stubGlobal("fetch", paystack);
	for (const path of Object.keys(migrations).sort()) {
		const statements = migrations[path]
			.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
			.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
		await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
	}
});
afterAll(() => vi.unstubAllGlobals());

async function call(path: string, token: string | undefined, method = "GET", body?: unknown) {
	const res = await app.fetch(
		new Request(`http://x${path}`, {
			method,
			headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		testEnv,
		{ waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
	);
	return { status: res.status, body: (await res.json().catch(() => ({}))) as any, headers: res.headers };
}

const signup = async (name: string) => (await call("/api/auth/signup", undefined, "POST", { email: `${name}@x.com`, password: "password123" })).body;

describe("create pot -> fund -> predict -> settle -> payout", () => {
	it("pays the winner exactly once and keeps payout data protected", async () => {
		const [potter, alice, bob] = await Promise.all(["potter", "alice", "bob"].map(signup));
		await db.sportsEventCache.create({
			data: {
				id: "espn:e2e", provider: "espn", externalId: "e2e", league: "eng.1", homeTeam: "A", awayTeam: "B",
				kickoffTimeUtc: new Date(Date.now() + 3 * 3_600_000), status: "scheduled", lastRefreshedAt: new Date(),
			},
		});

		const created = await call("/api/pots", potter.token, "POST", { eventId: "espn:e2e", prizeAmountMinorUnits: 10_000, winnerCount: 1 });
		expect(created.status).toBe(201);
		const potId = created.body.pot.id as string;
		const verified = await call(`/api/pots/${potId}/verify-funding`, potter.token, "POST");
		expect(verified.body.pot?.status ?? verified.body.status).toBe("Open");

		const account = await call("/api/payout-accounts", alice.token, "POST", { accountName: "Alice", accountNumber: "0123456789", bankCode: "044" });
		expect(account.body.payoutAccount.accountNumber).toBe("••••6789");
		const stored = await db.payoutAccount.findFirstOrThrow({ where: { userId: alice.user.id } });
		expect(stored.accountNumber).not.toContain("0123456789");
		expect(stored.accountLast4).toBe("6789");
		expect(account.headers.get("cache-control")).toBe("no-store");

		await call("/api/payout-accounts", bob.token, "POST", { accountName: "Bob", accountNumber: "0123456789", bankCode: "044" });

		expect((await call(`/api/pots/${potId}/predictions`, alice.token, "POST", { homeGoals: 2, awayGoals: 1 })).status).toBe(201);
		expect((await call(`/api/pots/${potId}/predictions`, bob.token, "POST", { homeGoals: 0, awayGoals: 0 })).status).toBe(201);

		await db.sportsEventCache.update({
			where: { id: "espn:e2e" },
			data: { kickoffTimeUtc: new Date(Date.now() - 3 * 3_600_000), status: "full time", homeScore: 2, awayScore: 1, isFinalResultOfficial: true },
		});
		const pots = new PotService(testEnv);
		await pots.syncStatuses();
		await new SettlementService(testEnv, pots).settleAll();
		await new SettlementService(testEnv, pots).settleAll();

		const jobs = queued.splice(0).filter((j) => j.type === "payout");
		expect(jobs).toHaveLength(1);
		expect(jobs[0].request).toMatchObject({ userId: alice.user.id, amountMinorUnits: 9_000, currency: "NGN" });

		const message = { body: jobs[0], attempts: 1, ack: vi.fn(), retry: vi.fn() };
		await handleTransferBatch({ messages: [message] } as never, testEnv);
		expect(message.ack).toHaveBeenCalled();

		const payouts = await db.ledgerEntry.findMany({ where: { potId, type: "payout" } });
		expect(payouts).toMatchObject([{ userId: alice.user.id, status: "successful", amountMinorUnits: 9_000 }]);
		expect((await db.pot.findUniqueOrThrow({ where: { id: potId } })).status).toBe("Paid");
		// The transfer targets the stored provider recipient, never the raw account number.
		const transferCall = paystack.mock.calls.find(([u]) => String(u).endsWith("/transfer"))!;
		expect(JSON.stringify(transferCall)).toContain("RCP_test");
		expect(JSON.stringify(transferCall)).not.toContain("0123456789");
		expect(await db.payoutAccount.findFirstOrThrow({ where: { userId: alice.user.id } })).toMatchObject({
			providerRecipientCode: "RCP_test",
			recipientProvider: "paystack",
		});
	});
});

describe("admin route permissions", () => {
	it("gives staff read access only and admins full access", async () => {
		const [staff, admin, user] = await Promise.all(["rstaff", "radmin", "ruser"].map(signup));
		await db.user.update({ where: { id: staff.user.id }, data: { role: "staff" } });
		await db.user.update({ where: { id: admin.user.id }, data: { role: "admin" } });

		const status = async (token: string, path: string, method = "GET", body?: unknown) => (await call(path, token, method, body)).status;
		expect(await status(user.token, "/api/admin/pots")).toBe(403);
		expect(await status(staff.token, "/api/admin/pots")).toBe(200);
		expect(await status(staff.token, "/api/admin/alerts")).toBe(200);
		expect(await status(staff.token, "/api/admin/staff")).toBe(403);
		expect(await status(staff.token, "/api/admin/audit")).toBe(403);
		expect(await status(staff.token, "/api/admin/transfers/retry", "POST", {})).toBe(403);
		expect(await status(admin.token, "/api/admin/staff")).toBe(200);
		expect(await status(admin.token, "/api/admin/audit")).toBe(200);
		expect(await status(admin.token, "/api/admin/alerts")).toBe(200);
	});
});
