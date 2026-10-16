// End-to-end (T11.3): signup -> create pot -> fund -> predict -> settle -> payout,
// through the real Hono app, D1, KV and queue consumer. Only Paystack's HTTP
// and the email binding are faked; OTP codes are read from the faked emails.
import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDbClient } from "@surescore/db";
import app from "../../src/router";
import { PotService } from "../../src/modules/pots/pot-service";
import { SignupService } from "../../src/modules/auth/signup";
import { OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from "../../src/modules/auth/otp/code";
import { SettlementService } from "../../src/modules/pots/settlement-service";
import { handleTransferBatch, type TransferJob } from "../../src/modules/payments/transfer-queue";
import { applyMigrations } from "../helpers/db";


const queued: TransferJob[] = [];
const send = vi.fn(async (job: TransferJob) => void queued.push(job));
/** Last email per recipient, captured from the fake send_email binding. */
const mail = new Map<string, { from: unknown; subject: string; text: string; html?: string }>();
const codeFor = (email: string) => mail.get(email.toLowerCase())?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
const testEnv = {
	...env,
	EMAIL: {
		send: async (message: { to: string; from: unknown; subject: string; text: string; html?: string }) => {
			mail.set(message.to, message);
			return { messageId: "msg-1" };
		},
	},
	TRANSFER_QUEUE: { send, sendBatch: async (jobs: { body: TransferJob }[]) => jobs.forEach((j) => queued.push(j.body)) },
} as unknown as Env;
const db = createDbClient(env.DB);


const paystack = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
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
	await applyMigrations();
});
afterAll(() => vi.unstubAllGlobals());

let clientSeq = 0;
async function call(path: string, token?: string, method = "GET", body?: unknown) {
	const res = await app.fetch(
		new Request(`http://x${path}`, {
			method,
			// A distinct client per call keeps the per-IP limiters out of the flows under test.
			headers: { "content-type": "application/json", "cf-connecting-ip": `10.0.0.${++clientSeq}`, ...(token && { authorization: `Bearer ${token}` }) },
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		testEnv,
		{ waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
	);
	return { status: res.status, body: (await res.json().catch(() => ({}))) as any, headers: res.headers };
}

let seq = 0;
const nextPhone = () => `+234803${String(1_000_000 + ++seq)}`;
const nextEmail = (name = "user") => `${name.toLowerCase().replace(/\W+/g, ".")}.${++seq}@example.com`;

const signup = async (name: string) => {
	const email = nextEmail(name);
	const started = await call("/api/auth/signup", undefined, "POST", { fullName: name, email, phone: nextPhone(), password: "password123" });
	expect(started.status).toBe(202);
	const verified = await call("/api/auth/signup/verify", undefined, "POST", { email, code: codeFor(email) });
	expect(verified.status).toBe(201);
	return verified.body;
};

describe("create pot -> fund -> predict -> settle -> payout", () => {
	it("pays the winner exactly once and keeps payout data protected", async () => {
		const [potter, alice, bob] = await Promise.all(["potter", "alice", "bob"].map(signup));
		await db.sportsEventCache.create({
			data: {
				id: "espn:e2e", provider: "espn", externalId: "e2e", league: "eng.1", homeTeam: "A", awayTeam: "B",
				kickoffTimeUtc: new Date(Date.now() + 3 * 3_600_000), status: "scheduled", lastRefreshedAt: new Date(),
			},
		});

		// A pot needs a refund account from the potter's saved bank accounts.
		const noRefundAccount = await call("/api/pots", potter.token, "POST", { eventId: "espn:e2e", prizeAmountMinorUnits: 10_000, winnerCount: 1, refundAccountId: "nope" });
		expect(noRefundAccount.status).toBe(422);
		const potterAccount = await call("/api/payout-accounts", potter.token, "POST", { accountName: "potter", accountNumber: "9876543210", bankCode: "058" });
		expect(potterAccount.status).toBe(201);

		const created = await call("/api/pots", potter.token, "POST", {
			eventId: "espn:e2e", prizeAmountMinorUnits: 10_000, winnerCount: 1, refundAccountId: potterAccount.body.payoutAccount.id,
		});
		expect(created.status).toBe(201);
		expect(created.body.pot.refundAccountId).toBe(potterAccount.body.payoutAccount.id);
		// Paystack always gets the business email, never the user's.
		const initCall = paystack.mock.calls.find(([u]) => String(u).endsWith("/transaction/initialize"))!;
		expect(JSON.parse(String(initCall[1]?.body)).email).toBe("info@corestack.com.ng");
		const potId = created.body.pot.id as string;
		const verified = await call(`/api/pots/${potId}/verify-funding`, potter.token, "POST");
		expect(verified.body.pot?.status ?? verified.body.status).toBe("Open");

		const account = await call("/api/payout-accounts", alice.token, "POST", { accountName: "Alice", accountNumber: "0123456789", bankCode: "044" });
		expect(account.body.payoutAccount.accountNumber).toBe("••••6789");
		const stored = await db.payoutAccount.findFirstOrThrow({ where: { userId: alice.user.id } });
		expect(stored.accountNumber).not.toContain("0123456789");
		expect(stored.accountLast4).toBe("6789");
		expect(account.headers.get("cache-control")).toBe("no-store");

		// Potter can also predict their own pot
		const potterPred = await call(`/api/pots/${potId}/predictions`, potter.token, "POST", { homeGoals: 1, awayGoals: 1 });
		expect(potterPred.status).toBe(201);

		// Second account for Alice, then set it as default, then soft delete it
		const alice2 = await call("/api/payout-accounts", alice.token, "POST", { accountName: "Alice", accountNumber: "1122334455", bankCode: "058" });
		expect(alice2.status).toBe(201);
		expect(alice2.body.payoutAccount.isDefault).toBe(false);

		// Set second account as active / default
		const patchRes = await call(`/api/payout-accounts/${alice2.body.payoutAccount.id}`, alice.token, "PATCH", { isDefault: true });
		expect(patchRes.status).toBe(200);
		expect(patchRes.body.payoutAccount.isDefault).toBe(true);

		// Soft delete the second account
		const delRes = await call(`/api/payout-accounts/${alice2.body.payoutAccount.id}`, alice.token, "DELETE");
		expect(delRes.status).toBe(200);

		// Listing accounts only returns active non-deleted accounts
		const listRes = await call("/api/payout-accounts", alice.token, "GET");
		expect(listRes.body.payoutAccounts).toHaveLength(1);
		expect(listRes.body.payoutAccounts[0].id).toBe(account.body.payoutAccount.id);

		// Name matching check: account name that does not match displayName is rejected
		const mismatchRes = await call("/api/payout-accounts", alice.token, "POST", { accountName: "Completely Different Name", accountNumber: "1234567890", bankCode: "044" });
		expect(mismatchRes.status).toBe(400);
		expect(mismatchRes.body.message).toContain("must match");

		await call("/api/payout-accounts", bob.token, "POST", { accountName: "Bob", accountNumber: "0123456789", bankCode: "044" });

		expect((await call(`/api/pots/${potId}/predictions`, alice.token, "POST", { homeGoals: 2, awayGoals: 1 })).status).toBe(201);
		expect((await call(`/api/pots/${potId}/predictions`, bob.token, "POST", { homeGoals: 0, awayGoals: 0 })).status).toBe(201);

		// My pots: the potter sees it as created (even though they predicted too), players as predicted.
		const myPots = async (token: string, role: string) =>
			(await call(`/api/pots?role=${role}`, token)).body.pots.map((p: { id: string; isPotter: boolean }) => [p.id, p.isPotter]);
		expect(await myPots(potter.token, "created")).toEqual([[potId, true]]);
		expect(await myPots(potter.token, "predicted")).toEqual([]);
		expect(await myPots(potter.token, "all")).toEqual([[potId, true]]);
		expect(await myPots(alice.token, "created")).toEqual([]);
		expect(await myPots(alice.token, "predicted")).toEqual([[potId, false]]);
		expect(await myPots(alice.token, "all")).toEqual([[potId, false]]);
		// Each pot carries the viewer's own pick, on every tab.
		const pick = async (token: string, role: string) => (await call(`/api/pots?role=${role}`, token)).body.pots[0].myPrediction;
		expect(await pick(potter.token, "created")).toEqual({ homeGoals: 1, awayGoals: 1, firstGoalMinute: null });
		expect(await pick(alice.token, "all")).toEqual({ homeGoals: 2, awayGoals: 1, firstGoalMinute: null });

		await db.sportsEventCache.update({
			where: { id: "espn:e2e" },
			data: { kickoffTimeUtc: new Date(Date.now() - 3 * 3_600_000), status: "finished", homeScore: 2, awayScore: 1, isFinalResultOfficial: true },
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
		// Paystack references only allow [a-z0-9_-].
		expect(JSON.parse(String(transferCall[1]?.body)).reference).toBe(`payout-${potId}-${alice.user.id}`);
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

describe("email signup with OTP", () => {
	it("creates the account only after the emailed code is confirmed, then signs in by email", async () => {
		const email = nextEmail("ada");
		const phone = nextPhone();
		const body = { fullName: "Ada Obi", email: `  ${email.toUpperCase()} `, phone, password: "password123" };
		const started = await call("/api/auth/signup", undefined, "POST", body);
		expect(started.status).toBe(202);
		expect(started.body).toMatchObject({ sentTo: email });
		const sent = mail.get(email)!;
		expect(sent).toMatchObject({ from: { email: "no-reply@corestack.com.ng", name: "SureScore" } });
		expect(sent.subject).toBe(`${codeFor(email)} is your SureScore verification code`);
		expect(sent.html).toContain(codeFor(email));
		expect(await db.user.findUnique({ where: { email } })).toBeNull();

		// Asking again straight away is throttled.
		expect((await call("/api/auth/signup/resend", undefined, "POST", { email })).status).toBe(429);
		expect((await call("/api/auth/signup", undefined, "POST", body)).status).toBe(429);

		const wrong = codeFor(email) === "000000" ? "111111" : "000000";
		const bad = await call("/api/auth/signup/verify", undefined, "POST", { email, code: wrong });
		expect(bad.status).toBe(400);
		expect(bad.body.message).toContain(`${OTP_MAX_ATTEMPTS - 1} attempts left`);

		const verified = await call("/api/auth/signup/verify", undefined, "POST", { email, code: codeFor(email) });
		expect(verified.status).toBe(201);
		expect(verified.body.user).toMatchObject({ email, phone, displayName: "Ada Obi", countryCode: "NG" });
		const stored = await db.user.findUniqueOrThrow({ where: { email } });
		expect(stored.emailVerifiedAt).not.toBeNull();
		expect(stored.phoneVerifiedAt).toBeNull();

		// Codes are single use and the email is now taken (in any letter case).
		expect((await call("/api/auth/signup/verify", undefined, "POST", { email, code: codeFor(email) })).status).toBe(410);
		expect((await call("/api/auth/signup", undefined, "POST", { ...body, phone: nextPhone() })).status).toBe(409);

		expect((await call("/api/auth/login", undefined, "POST", { email, password: "wrong-password" })).status).toBe(401);
		const login = await call("/api/auth/login", undefined, "POST", { email: email.toUpperCase(), password: "password123" });
		expect(login.status).toBe(200);
		expect(login.body.user.id).toBe(verified.body.user.id);
		expect((await call("/api/auth/login", undefined, "POST", { phone, password: "password123" })).status).toBe(400);
		expect((await call("/api/auth/me", login.body.token)).body.email).toBe(email);
		expect((await call("/api/auth/me", undefined)).status).toBe(401);
	});

	it("needs a valid email and a valid phone, and lets an unverified phone be reused", async () => {
		const base = { fullName: "X Y", password: "password123" };
		expect((await call("/api/auth/signup", undefined, "POST", { ...base, phone: nextPhone() })).status).toBe(400);
		expect((await call("/api/auth/signup", undefined, "POST", { ...base, email: "not-an-email", phone: nextPhone() })).status).toBe(400);
		for (const phone of ["+23480312", "+14155550123"]) {
			expect((await call("/api/auth/signup", undefined, "POST", { ...base, email: nextEmail(), phone })).status).not.toBe(202);
		}
		// Phones aren't verified, so one number can't block someone else's signup.
		const shared = nextPhone();
		for (const email of [nextEmail(), nextEmail()]) {
			expect((await call("/api/auth/signup", undefined, "POST", { ...base, email, phone: shared })).status).toBe(202);
		}
	});

	it("burns the code after too many wrong guesses, expires it, and caps resends", async () => {
		let now = Date.now();
		const sent: string[] = [];
		const fakeEmail = () => ({ id: "fake", send: async ({ text }: { text: string }) => (sent.push(text), { provider: "fake", messageId: null }) });
		const service = new SignupService(env, fakeEmail, () => now);
		const email = nextEmail("bola");
		const start = () => service.start({ email, phone: nextPhone(), displayName: "Bola Ade", password: "password123", countryCode: "NG" });
		const code = () => sent.at(-1)!.match(/\d{6}/)![0];

		await start();
		const wrong = code() === "000000" ? "111111" : "000000";
		for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await expect(service.verify(email, wrong)).rejects.toThrow();
		await expect(service.verify(email, code())).rejects.toThrow(/Too many incorrect attempts/);

		now += 61_000;
		await service.resend(email);
		now += OTP_TTL_SECONDS * 1000;
		await expect(service.verify(email, code())).rejects.toThrow(/expired/);

		now += 61_000;
		await start();
		for (let i = sent.length; i < 5; i++) {
			now += 61_000;
			await service.resend(email);
		}
		now += 61_000;
		await expect(service.resend(email)).rejects.toThrow(/Too many codes/);
		expect(sent).toHaveLength(5);
		const user = await service.verify(email, code());
		expect(user.email).toBe(email);
	});
});

describe("refunds", () => {
	it("refunds a pot nobody predicted to the potter's refund account, less the platform fee", async () => {
		const potter = await signup("Refund Potter");
		await db.sportsEventCache.create({
			data: {
				id: "espn:nowin", provider: "espn", externalId: "nowin", league: "eng.1", homeTeam: "C", awayTeam: "D",
				kickoffTimeUtc: new Date(Date.now() + 3 * 3_600_000), status: "scheduled", lastRefreshedAt: new Date(),
			},
		});
		const account = await call("/api/payout-accounts", potter.token, "POST", { accountName: "Refund Potter", accountNumber: "5555555555", bankCode: "058" });
		const potId = (await call("/api/pots", potter.token, "POST", {
			eventId: "espn:nowin", prizeAmountMinorUnits: 10_000, winnerCount: 1, refundAccountId: account.body.payoutAccount.id,
		})).body.pot.id as string;
		await call(`/api/pots/${potId}/verify-funding`, potter.token, "POST");

		await db.sportsEventCache.update({
			where: { id: "espn:nowin" },
			data: { kickoffTimeUtc: new Date(Date.now() - 3 * 3_600_000), status: "finished", homeScore: 0, awayScore: 0, isFinalResultOfficial: true },
		});
		queued.splice(0);
		const pots = new PotService(testEnv);
		await pots.syncStatuses();
		await new SettlementService(testEnv, pots).settleAll();

		const [job] = queued.splice(0);
		expect(job).toMatchObject({
			type: "refund",
			request: { potId, reason: "no-winner", amountMinorUnits: 9_000, payoutAccountId: account.body.payoutAccount.id },
		});
		paystack.mockClear();
		const message = { body: job, attempts: 1, ack: vi.fn(), retry: vi.fn() };
		await handleTransferBatch({ messages: [message] } as never, testEnv, { onRefunded: (id) => pots.markRefunded(id) });

		// Sent as a transfer to the refund account, not a reversal to the paying card.
		expect(paystack.mock.calls.some(([u]) => String(u).endsWith("/refund"))).toBe(false);
		const transfer = paystack.mock.calls.find(([u]) => String(u).endsWith("/transfer"))!;
		expect(JSON.parse(String(transfer[1]?.body))).toMatchObject({ amount: 9_000, reference: `refund-${potId}` });
		expect((await db.pot.findUniqueOrThrow({ where: { id: potId } })).status).toBe("Refunded");

		// Cancelled/refunded pots are hidden from "My pots" unless asked for.
		expect((await call("/api/pots", potter.token)).body.pots.map((p: { id: string }) => p.id)).not.toContain(potId);
		expect((await call("/api/pots?includeCancelled=true", potter.token)).body.pots.map((p: { id: string }) => p.id)).toContain(potId);
	});
});

describe("forgot password", () => {
	it("resets the password with an emailed code and signs out other sessions", async () => {
		const account = await signup("Reset Me");
		const email = account.user.email as string;
		expect((await call("/api/auth/password/forgot", undefined, "POST", { email: nextEmail() })).status).toBe(404);

		const started = await call("/api/auth/password/forgot", undefined, "POST", { email });
		expect(started.status).toBe(202);
		const code = codeFor(email);
		expect(mail.get(email)!.text).toContain("reset your SureScore password");

		// A reset code is not a signup code, and a wrong code is rejected.
		const wrong = code === "000000" ? "111111" : "000000";
		expect((await call("/api/auth/password/verify", undefined, "POST", { email, code: wrong })).status).toBe(400);
		const verified = await call("/api/auth/password/verify", undefined, "POST", { email, code });
		expect(verified.status).toBe(200);
		expect((await call("/api/auth/password/verify", undefined, "POST", { email, code })).status).toBe(410);

		const reset = await call("/api/auth/password/reset", undefined, "POST", { resetToken: verified.body.resetToken, password: "new-password-1" });
		expect(reset.status).toBe(200);
		expect((await call("/api/auth/password/reset", undefined, "POST", { resetToken: verified.body.resetToken, password: "again-again" })).status).toBe(410);

		// The old session is signed out; the new one works; only the new password signs in.
		expect((await call("/api/auth/me", account.token)).status).toBe(401);
		expect((await call("/api/auth/me", reset.body.token)).status).toBe(200);
		expect((await call("/api/auth/login", undefined, "POST", { email, password: "password123" })).status).toBe(401);
		expect((await call("/api/auth/login", undefined, "POST", { email, password: "new-password-1" })).status).toBe(200);

		// Sessions are unique even when issued in the same second.
		const [a1, a2] = await Promise.all([1, 2].map(() => call("/api/auth/login", undefined, "POST", { email, password: "new-password-1" })));
		expect(a1.body.token).not.toBe(a2.body.token);
		await call("/api/auth/logout", a1.body.token, "POST");
		expect((await call("/api/auth/me", a2.body.token)).status).toBe(200);
	});
});

describe("profile", () => {
	it("lets users change their full name and phone, but not their sign-in email", async () => {
		const account = await signup("Old Name");
		const updated = await call("/api/auth/me", account.token, "PATCH", { fullName: "  New Name  " });
		expect(updated.body).toMatchObject({ displayName: "New Name", email: account.user.email });
		expect((await call("/api/auth/me", account.token, "PATCH", { phone: "+2348099999999" })).body.phone).toBe("+2348099999999");
		expect((await call("/api/auth/me", account.token, "PATCH", { phone: "+14155550123" })).status).toBe(422);
		expect((await call("/api/auth/me", account.token, "PATCH", { fullName: "x" })).status).toBe(400);
		expect((await call("/api/auth/me", account.token, "PATCH", {})).status).toBe(400);
		expect((await call("/api/auth/me", account.token, "PATCH", { email: "other@example.com" })).status).toBe(400);
	});
});

describe("private pots", () => {
	it("hides private pots from discovery and admits only the potter, link holders and players", async () => {
		const [potter, friend, stranger] = await Promise.all(["Private Potter", "Invited Friend", "Random Stranger"].map(signup));
		await db.sportsEventCache.create({
			data: {
				id: "espn:priv", provider: "espn", externalId: "priv", league: "eng.1", homeTeam: "E", awayTeam: "F",
				kickoffTimeUtc: new Date(Date.now() + 3 * 3_600_000), status: "scheduled", lastRefreshedAt: new Date(),
			},
		});
		const account = await call("/api/payout-accounts", potter.token, "POST", { accountName: "Private Potter", accountNumber: "4444444444", bankCode: "058" });
		const created = await call("/api/pots", potter.token, "POST", {
			eventId: "espn:priv", prizeAmountMinorUnits: 10_000, winnerCount: 1, refundAccountId: account.body.payoutAccount.id, isPrivate: true,
		});
		const potId = created.body.pot.id as string;
		expect(created.body.pot).toMatchObject({ isPrivate: true, shareCode: null });
		const funded = await call(`/api/pots/${potId}/verify-funding`, potter.token, "POST");
		const shareCode = (funded.body.pot ?? funded.body).shareCode as string;
		expect(shareCode).toBeTruthy();

		// Not listed publicly, and not counted on popular matches.
		const listed = await call("/api/discover/pots?limit=1000");
		expect(listed.body.pots.map((p: { id: string }) => p.id)).not.toContain(potId);
		const popular = await call("/api/discover/matches/popular?limit=50");
		expect(popular.body.matches.find((m: { cacheId: string }) => m.cacheId === "espn:priv")?.potCount ?? 0).toBe(0);

		// Without the link it doesn't exist; with it, anyone can view; the potter always can.
		expect((await call(`/api/discover/pots/${potId}`)).status).toBe(404);
		expect((await call(`/api/discover/pots/${potId}`, stranger.token)).status).toBe(404);
		expect((await call(`/api/discover/pots/${potId}?code=wrong`)).status).toBe(404);
		expect((await call(`/api/discover/pots/${potId}?code=${shareCode}`)).body.pot).toMatchObject({ id: potId, isPrivate: true });
		expect((await call(`/api/discover/pots/${potId}`, potter.token)).status).toBe(200);

		for (const [user, name] of [[friend, "Invited Friend"], [stranger, "Random Stranger"]] as const) {
			await call("/api/payout-accounts", user.token, "POST", { accountName: name, accountNumber: "3333333333", bankCode: "044" });
		}
		const pick = { homeGoals: 1, awayGoals: 0 };
		expect((await call(`/api/pots/${potId}/predictions`, stranger.token, "POST", pick)).status).toBe(404);
		expect((await call(`/api/pots/${potId}/predictions`, friend.token, "POST", { ...pick, shareCode })).status).toBe(201);

		// Having predicted, the friend keeps access without the link.
		expect((await call(`/api/discover/pots/${potId}`, friend.token)).status).toBe(200);
		expect((await call(`/api/pots/${potId}/predictions`, friend.token, "PUT", { homeGoals: 2, awayGoals: 0 })).status).toBe(200);
	});
});

describe("pre-lock leaderboard", () => {
	it("pages every prediction to anyone who can see the pot, hiding picks until lock", async () => {
		const [potter, player] = await Promise.all(["List Potter", "List Player"].map(signup));
		await db.sportsEventCache.create({
			data: {
				id: "espn:list", provider: "espn", externalId: "list", league: "eng.1", homeTeam: "G", awayTeam: "H",
				kickoffTimeUtc: new Date(Date.now() + 3 * 3_600_000), status: "scheduled", lastRefreshedAt: new Date(),
			},
		});
		const account = await call("/api/payout-accounts", potter.token, "POST", { accountName: "List Potter", accountNumber: "5555555555", bankCode: "058" });
		const potId = (await call("/api/pots", potter.token, "POST", {
			eventId: "espn:list", prizeAmountMinorUnits: 10_000, winnerCount: 1, refundAccountId: account.body.payoutAccount.id,
		})).body.pot.id as string;
		await call(`/api/pots/${potId}/verify-funding`, potter.token, "POST");

		// More than D1's 100 bound parameters, so the user lookup must cope too.
		for (let i = 0; i < 120; i++) {
			const user = await db.user.create({ data: { passwordHash: "x", passwordSalt: "x", countryCode: "NG", displayName: `Bulk ${i}` } });
			await db.prediction.create({ data: { potId, userId: user.id, homeGoals: i % 5, awayGoals: 1 } });
		}

		// Any viewer of the pot sees who has entered, but no picks before lock.
		const early = await call(`/api/pots/${potId}/predictions?limit=1`, player.token);
		expect(early.status).toBe(200);
		expect(early.body.predictions[0]).toMatchObject({ homeGoals: null, awayGoals: null, firstGoalMinute: null });
		expect(early.body.predictions[0].submittedAt).toEqual(expect.any(String));
		expect((await call(`/api/pots/${potId}/leaderboard`, player.token)).status).toBe(403);

		const pages: { revealed: boolean; predictions: { id: string; homeGoals: number | null }[]; nextCursor: string | null }[] = [];
		let cursor: string | null = "";
		while (cursor !== null) {
			const page = await call(`/api/pots/${potId}/predictions?limit=50${cursor ? `&cursor=${cursor}` : ""}`, potter.token);
			expect(page.status).toBe(200);
			pages.push(page.body);
			cursor = page.body.nextCursor;
		}
		expect(pages.map((p) => p.predictions.length)).toEqual([50, 50, 20]);
		const ids = pages.flatMap((p) => p.predictions.map((e) => e.id));
		expect(new Set(ids).size).toBe(120);
		expect(ids).toEqual([...ids].sort());
		expect(pages.every((p) => !p.revealed && p.predictions.every((e) => e.homeGoals === null))).toBe(true);

		// The default page holds all of them; once predictions lock the picks are shown.
		await db.sportsEventCache.update({ where: { id: "espn:list" }, data: { kickoffTimeUtc: new Date(Date.now() + 5 * 60_000) } });
		const all = (await call(`/api/pots/${potId}/predictions`, potter.token)).body;
		expect(all).toMatchObject({ revealed: true, nextCursor: null });
		expect(all.predictions).toHaveLength(120);
		expect(all.predictions.find((e: { displayName: string }) => e.displayName === "Bulk 7")).toMatchObject({ homeGoals: 2, awayGoals: 1 });
		const board = (await call(`/api/pots/${potId}/leaderboard`, player.token)).body;
		expect(board.entries).toHaveLength(120);
		expect(board.entries.every((e: { submittedAt: string }) => !Number.isNaN(Date.parse(e.submittedAt)))).toBe(true);
	});
});
