import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@surescore/db";
import { evaluateAlerts } from "../src/lib/alerts";
import { AdminStaffService } from "../src/lib/admin-staff";
import { AUDIT_ACTIONS } from "../src/lib/audit";
import { redact } from "../src/lib/logger";
import { PAGE_MAX, toPage } from "../src/lib/pagination";
import { rateLimit } from "../src/lib/rate-limit";
import { ReconciliationService } from "../src/lib/reconciliation-service";
import { decrypt, encrypt, sealAccountNumber, toPublicAccount } from "../src/lib/secure-data";
import type { AppEnv } from "../src/types";

const migrations = (import.meta as unknown as { glob: (p: string, o: object) => unknown }).glob("../../../packages/db/prisma/migrations/*/migration.sql", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;
const db = createDbClient(env.DB);

beforeAll(async () => {
	for (const path of Object.keys(migrations).sort()) {
		const statements = migrations[path].split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
			.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
		await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
	}
});

describe("payout data protection", () => {
	it("encrypts at rest, masks in responses and fingerprints deterministically", async () => {
		const sealed = await sealAccountNumber("k", "0123456789", "044");
		expect(sealed.accountNumber).not.toContain("0123456789");
		expect(await decrypt("k", sealed.accountNumber)).toBe("0123456789");
		expect((await sealAccountNumber("k", "0123456789", "044")).accountNumberHash).toBe(sealed.accountNumberHash);
		expect((await sealAccountNumber("k", "0123456789", "058")).accountNumberHash).not.toBe(sealed.accountNumberHash);
		const view = toPublicAccount({ ...sealed, id: "a" });
		expect(view).toMatchObject({ accountNumber: "••••6789" });
		expect(view).not.toHaveProperty("accountNumberHash");
		expect(await decrypt("k", "legacy-plain")).toBe("legacy-plain");
		await expect(decrypt("wrong", await encrypt("k", "x"))).rejects.toThrow();
		await expect(encrypt(undefined, "x")).rejects.toThrow();
	});

	it("redacts secrets and account data from logs", () => {
		expect(redact({ idempotencyKey: "k", accountNumber: "1", nested: { token: "t", apiKey: "a" } })).toEqual({
			idempotencyKey: "k",
			accountNumber: "[redacted]",
			nested: { token: "[redacted]", apiKey: "[redacted]" },
		});
	});

	it("detects payout accounts shared by different winners without exposing numbers", async () => {
		const user = (id: string) => ({ id, email: `${id}@s.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG" });
		await db.user.createMany({ data: [user("s1"), user("s2")] });
		for (const userId of ["s1", "s2"]) {
			await db.payoutAccount.create({
				data: { userId, countryCode: "NG", provider: "paystack", accountName: "N", ...(await sealAccountNumber("k", "0123456789", "044")) },
			});
		}
		const shared = await (new ReconciliationService(env.DB) as any).sharedAccounts(["s1"]);
		expect([...shared.values()]).toEqual([["s1", "s2"]].map((ids) => expect.arrayContaining(ids)));
		expect([...shared.keys()].join()).not.toContain("0123456789");
	});
});

describe("rate limiting", () => {
	it("returns 429 with Retry-After past the limit", async () => {
		const app = new Hono<AppEnv>();
		app.use("*", rateLimit({ name: "t", limit: 2, windowSeconds: 60, by: "ip" }));
		app.get("/", (c) => c.text("ok"));
		const hit = () => app.request("/", { headers: { "CF-Connecting-IP": "9.9.9.9" } }, env);
		expect([(await hit()).status, (await hit()).status]).toEqual([200, 200]);
		const limited = await hit();
		expect(limited.status).toBe(429);
		expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
		expect((await app.request("/", { headers: { "CF-Connecting-IP": "8.8.8.8" } }, env)).status).toBe(200);
	});
});

describe("alerts", () => {
	const health = (over: object = {}) => ({
		sports: [{ provider: "espn", events: 10, stale: 0, lastRefreshedAt: new Date(), failedJobs24h: 0 }],
		payments: [{ provider: "paystack", successful24h: 5, pending24h: 0, failed24h: 0, failureRate: 0, lastFailureAt: null, lastFailureDetail: null }],
		jobs: [],
		recentFailures: [],
		...over,
	});

	it("is quiet when healthy", () => expect(evaluateAlerts(health() as never, 0)).toEqual([]));

	it("raises provider, stale-data, payout and job alerts", () => {
		const kinds = evaluateAlerts(
			health({
				sports: [{ provider: "espn", events: 10, stale: 3, lastRefreshedAt: new Date(), failedJobs24h: 2 }],
				payments: [{ provider: "paystack", successful24h: 1, pending24h: 0, failed24h: 3, failureRate: 0.75, lastFailureAt: null, lastFailureDetail: null }],
				jobs: [{ job: "settlement", kind: "payments", runs24h: 3, failures24h: 1, lastRunAt: new Date() }],
			}) as never,
			2,
		).map((a) => a.kind);
		expect(new Set(kinds)).toEqual(new Set(["provider_failure", "stale_sports_data", "failed_payouts", "failed_job"]));
	});
});

describe("staff management and audit", () => {
	const staff = new AdminStaffService(env.DB);
	const user = (id: string, role = "user") => ({ id, email: `${id}@m.com`, passwordHash: "h", passwordSalt: "s", countryCode: "NG", role });

	it("guards roles and audits every change", async () => {
		await db.adminAuditLog.deleteMany();
		await db.user.createMany({ data: [user("adm1", "admin"), user("adm2", "admin"), user("plain")] });
		await expect(staff.changeRole("adm1", "adm1", "staff", "demote myself")).rejects.toThrow(/own role/);
		await staff.changeRole("adm1", "plain", "staff", "new support hire");
		await staff.changeRole("adm1", "adm2", "staff", "reduced scope");
		await expect(staff.changeRole("adm2", "adm1", "user", "remove last admin")).rejects.toThrow(/last admin/);
		await expect(staff.create("adm1", { email: "new@m.com", role: "staff", reason: "needs password" })).rejects.toThrow(/password/);
		const created = await staff.create("adm1", { email: "new@m.com", role: "staff", password: "password123", reason: "onboarding" });
		expect(created.role).toBe("staff");
		expect(created).not.toHaveProperty("passwordHash");

		const audit = await staff.audit({});
		expect(audit.items.map((a) => a.action).sort()).toEqual(["staff.create", "staff.role_change", "staff.role_change"]);
		expect(audit.items.every((a) => a.reason.length >= 5 && a.actorEmail)).toBe(true);
		expect(AUDIT_ACTIONS).toContain("staff.role_change");
		expect((await staff.list({ role: "staff" })).items.map((u) => u.id)).toContain("plain");
	});
});

describe("pagination", () => {
	it("defaults to 1000 and reports a cursor only when more rows exist", () => {
		expect(PAGE_MAX).toBe(1000);
		const rows = Array.from({ length: 4 }, (_, i) => ({ id: String(i) }));
		expect(toPage(rows, 3)).toEqual({ items: rows.slice(0, 3), nextCursor: "2" });
		expect(toPage(rows.slice(0, 3), 3).nextCursor).toBeNull();
		expect(toPage(rows).items).toHaveLength(4);
	});
});

describe("popular matches", () => {
	it("ranks upcoming matches by provider importance, then kickoff", async () => {
		const base = { provider: "espn", league: "t", homeTeam: "H", awayTeam: "A", status: "scheduled", lastRefreshedAt: new Date() };
		const at = (h: number) => new Date(Date.now() + h * 3_600_000);
		await db.sportsEventCache.createMany({
			data: [
				{ ...base, id: "espn:p1", externalId: "p1", kickoffTimeUtc: at(1), importance: 0 },
				{ ...base, id: "espn:p2", externalId: "p2", kickoffTimeUtc: at(3), importance: 3 },
				{ ...base, id: "espn:p3", externalId: "p3", kickoffTimeUtc: at(2), importance: 3 },
			],
		});
		const { default: app } = await import("../src/index");
		const res = await app.fetch(new Request("http://x/api/discover/matches/popular"), env, { waitUntil() {}, passThroughOnException() {} } as never);
		const ids = ((await res.json()) as { matches: { id: string }[] }).matches.map((m) => m.id);
		expect(ids.slice(0, 3)).toEqual(["p3", "p2", "p1"]);
	});
});
