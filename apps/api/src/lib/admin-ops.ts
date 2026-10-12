// Read-only operational views for admins: provider health and job failures
// (T10.7) and searchable ledger history for support (T10.8).

import { createDbClient } from "@surescore/db";
import { paymentProviderConfigs, sportsProviderConfigs } from "@surescore/shared";
import { toPage } from "./chunk.js";

const DAY_MS = 86_400_000;

export interface LedgerSearch {
	q?: string;
	type?: string;
	status?: string;
	currency?: string;
	provider?: string;
	potId?: string;
	userId?: string;
	from?: Date;
	to?: Date;
	limit: number;
	cursor?: string;
}

export class AdminOpsService {
	private readonly db;

	constructor(database: D1Database) {
		this.db = createDbClient(database);
	}

	async health(now = new Date()) {
		const since = new Date(now.getTime() - DAY_MS);
		const [events, transfers, lastFailures, runs, failedRuns] = await Promise.all([
			this.db.sportsEventCache.groupBy({
				by: ["provider", "freshness"],
				_count: { _all: true },
				_max: { lastRefreshedAt: true },
			}),
			this.db.ledgerEntry.groupBy({ by: ["provider", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
			this.db.ledgerEntry.findMany({
				where: { status: "failed", createdAt: { gte: since } },
				orderBy: { createdAt: "desc" },
				distinct: ["provider"],
				select: { provider: true, createdAt: true, detail: true },
			}),
			this.db.jobRun.groupBy({
				by: ["job", "kind", "status"],
				where: { startedAt: { gte: since } },
				_count: { _all: true },
				_max: { startedAt: true },
			}),
			this.db.jobRun.findMany({ where: { status: "failed" }, orderBy: { startedAt: "desc" }, take: 50 }),
		]);

		const sports = sportsProviderConfigs.map(({ id }) => {
			const rows = events.filter((e) => e.provider === id);
			const count = (freshness?: string) =>
				rows.filter((r) => !freshness || r.freshness === freshness).reduce((sum, r) => sum + r._count._all, 0);
			const refreshed = rows.map((r) => r._max.lastRefreshedAt).filter((d): d is Date => !!d);
			return {
				provider: id,
				events: count(),
				stale: count("stale"),
				lastRefreshedAt: refreshed.length ? new Date(Math.max(...refreshed.map((d) => d.getTime()))) : null,
				failedJobs24h: runs.filter((r) => r.kind === "sports" && r.status === "failed").reduce((s, r) => s + r._count._all, 0),
			};
		});

		const payments = paymentProviderConfigs.map(({ id }) => {
			const count = (status: string) =>
				transfers.filter((t) => t.provider === id && t.status === status).reduce((s, t) => s + t._count._all, 0);
			const failure = lastFailures.find((f) => f.provider === id);
			const [successful, pending, failed] = [count("successful"), count("pending"), count("failed")];
			return {
				provider: id,
				successful24h: successful,
				pending24h: pending,
				failed24h: failed,
				failureRate: successful + failed > 0 ? failed / (successful + failed) : 0,
				lastFailureAt: failure?.createdAt ?? null,
				lastFailureDetail: failure?.detail ?? null,
			};
		});

		const jobNames = [...new Set(runs.map((r) => r.job))].sort();
		const jobs = jobNames.map((job) => {
			const rows = runs.filter((r) => r.job === job);
			const failed = rows.filter((r) => r.status === "failed");
			const last = rows.reduce<Date | null>((a, r) => (!a || (r._max.startedAt && r._max.startedAt > a) ? r._max.startedAt : a), null);
			return {
				job,
				kind: rows[0].kind,
				runs24h: rows.reduce((s, r) => s + r._count._all, 0),
				failures24h: failed.reduce((s, r) => s + r._count._all, 0),
				lastRunAt: last,
			};
		});

		return { sports, payments, jobs, recentFailures: failedRuns };
	}

	async searchLedger(search: LedgerSearch) {
		const { q, from, to, limit, cursor, ...exact } = search;
		const term = q?.trim();
		const where = {
			...Object.fromEntries(Object.entries(exact).filter(([, v]) => v)),
			...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
			...(term
				? {
						OR: term.includes("@")
							? [{ user: { email: { contains: term.toLowerCase() } } }]
							: [{ reference: term }, { idempotencyKey: term }, { potId: term }, { userId: term }],
					}
				: {}),
		};
		const rows = await this.db.ledgerEntry.findMany({
			where,
			include: { user: { select: { email: true, displayName: true } } },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: limit + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});
		return toPage(rows, limit);
	}
}
