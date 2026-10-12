// Daily reconciliation (fraud/accounting control). Loads a bounded window of
// pots plus their ledger aggregates, runs the pure rules from
// @surescore/shared, and records new anomalies as reviewable findings.
// Scope: pots updated or with ledger activity in the last `days`, plus any pot
// with an unresolved pending/failed ledger row, so old problems are never dropped.
// Re-runs are idempotent: a finding's fingerprint is stored once.

import { createDbClient } from "@surescore/db";
import {
	participantKey,
	reconcile,
	summarizeLedger,
	type ReconLedgerGroup,
	type ReconPot,
} from "@surescore/shared";
import { inChunks, toPage } from "./chunk.js";
import { fail } from "./pot-service.js";
import type { AdminPotService } from "./admin-pots.js";

const DAY_MS = 86_400_000;
export const DEFAULT_SCOPE_DAYS = 7;

export class ReconciliationService {
	private readonly db;

	constructor(
		database: D1Database,
		private readonly adminPots?: AdminPotService,
	) {
		this.db = createDbClient(database);
	}

	async run({ days = DEFAULT_SCOPE_DAYS, now = new Date() }: { days?: number; now?: Date } = {}) {
		const scopeFrom = new Date(now.getTime() - days * DAY_MS);
		const { pots, potIds } = await this.loadPots(scopeFrom);

		const [groups, predictionCounts, unfundedCancels] = await Promise.all([
			inChunks(potIds, (ids) =>
				this.db.ledgerEntry.groupBy({
					by: ["idempotencyKey", "potId", "userId", "type", "status", "currency"],
					where: { potId: { in: ids } },
					_count: { _all: true },
					_max: { amountMinorUnits: true, createdAt: true },
				}),
			),
			inChunks(potIds, (ids) =>
				this.db.prediction.groupBy({ by: ["potId"], where: { potId: { in: ids } }, _count: { _all: true } }),
			),
			inChunks(potIds, (ids) =>
				this.db.potStateTransition.findMany({
					where: { potId: { in: ids }, toStatus: "Cancelled", fromStatus: "Draft" },
					select: { potId: true },
				}),
			),
		]);

		const ledger: ReconLedgerGroup[] = groups.map((g) => ({
			idempotencyKey: g.idempotencyKey,
			potId: g.potId,
			userId: g.userId,
			type: g.type as ReconLedgerGroup["type"],
			status: g.status as ReconLedgerGroup["status"],
			currency: g.currency,
			amountMinorUnits: g._max.amountMinorUnits ?? 0,
			rows: g._count._all,
			lastAt: g._max.createdAt ?? now,
		}));
		const counts = new Map(predictionCounts.map((p) => [p.potId, p._count._all]));
		const unfunded = new Set(unfundedCancels.map((t) => t.potId));
		const reconPots: ReconPot[] = pots.map((p) => ({
			...p,
			cancelledBeforeFunding: unfunded.has(p.id),
			predictionCount: counts.get(p.id) ?? 0,
		}));

		const payouts = ledger.filter((g) => g.type === "payout" && g.status !== "failed");
		const findings = reconcile({
			pots: reconPots,
			groups: ledger,
			participants: await this.participants([...new Set(payouts.map((g) => g.potId))]),
			sharedAccounts: await this.sharedAccounts([...new Set(payouts.map((g) => g.userId))]),
			now,
		});

		const run = await this.db.reconciliationRun.create({
			data: {
				scopeFrom,
				potsChecked: pots.length,
				findingCount: 0,
				summary: JSON.stringify(summarizeLedger(reconPots, ledger)),
			},
		});
		const known = new Set(
			(
				await inChunks(
					findings.map((f) => f.fingerprint),
					(fps) => this.db.reconciliationFinding.findMany({ where: { fingerprint: { in: fps } }, select: { fingerprint: true } }),
				)
			).map((f) => f.fingerprint),
		);
		const fresh = findings.filter((f) => !known.has(f.fingerprint));
		if (fresh.length > 0) {
			await this.db.reconciliationFinding.createMany({ data: fresh.map((f) => ({ ...f, runId: run.id })) });
			await this.db.reconciliationRun.update({ where: { id: run.id }, data: { findingCount: fresh.length } });
		}
		return { runId: run.id, potsChecked: pots.length, newFindings: fresh.length };
	}

	async latest() {
		const run = await this.db.reconciliationRun.findFirst({ orderBy: { startedAt: "desc" } });
		const openBySeverity = await this.db.reconciliationFinding.groupBy({
			by: ["severity"],
			where: { status: "open" },
			_count: { _all: true },
		});
		return {
			run: run && { ...run, summary: JSON.parse(run.summary) as unknown },
			open: Object.fromEntries(openBySeverity.map((r) => [r.severity, r._count._all])),
		};
	}

	async findings({ status, limit, cursor }: { status: string; limit: number; cursor?: string }) {
		const rows = await this.db.reconciliationFinding.findMany({
			where: { status },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: limit + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});
		return toPage(rows, limit);
	}

	async resolve(adminId: string, findingId: string, note: string) {
		const { count } = await this.db.reconciliationFinding.updateMany({
			where: { id: findingId, status: "open" },
			data: { status: "resolved", resolvedBy: adminId, resolutionNote: note, resolvedAt: new Date() },
		});
		if (count === 0) fail(404, "No open finding with that id.");
		await this.adminPots?.audit(adminId, "reconciliation.resolve", note, { subject: findingId });
	}

	private async loadPots(scopeFrom: Date) {
		const [recent, open] = await Promise.all([
			this.db.pot.findMany({ where: { updatedAt: { gte: scopeFrom } }, select: potFields }),
			this.db.ledgerEntry.findMany({
				where: { OR: [{ createdAt: { gte: scopeFrom } }, { status: { in: ["pending", "failed"] } }] },
				distinct: ["potId"],
				select: { potId: true },
			}),
		]);
		const have = new Set(recent.map((p) => p.id));
		const extra = await inChunks(
			open.map((o) => o.potId).filter((id) => !have.has(id)),
			(ids) => this.db.pot.findMany({ where: { id: { in: ids } }, select: potFields }),
		);
		const pots = [...recent, ...extra];
		return { pots, potIds: pots.map((p) => p.id) };
	}

	private async participants(potIds: string[]) {
		const rows = await inChunks(potIds, (ids) =>
			this.db.prediction.findMany({ where: { potId: { in: ids } }, select: { potId: true, userId: true } }),
		);
		return new Set(rows.map((r) => participantKey(r.potId, r.userId)));
	}

	/** Payout accounts (bank + number) used by winners and at least one other user. */
	private async sharedAccounts(winnerIds: string[]) {
		const mine = await inChunks(winnerIds, (ids) =>
			this.db.payoutAccount.findMany({ where: { userId: { in: ids } }, select: { accountNumber: true, bankCode: true } }),
		);
		const numbers = [...new Set(mine.map((a) => a.accountNumber))];
		const same = await inChunks(numbers, (chunk) =>
			this.db.payoutAccount.findMany({
				where: { accountNumber: { in: chunk } },
				select: { accountNumber: true, bankCode: true, userId: true },
			}),
		);
		const owners = new Map<string, Set<string>>();
		for (const a of same) {
			const key = `${a.bankCode ?? ""}/${a.accountNumber}`;
			owners.set(key, (owners.get(key) ?? new Set()).add(a.userId));
		}
		return new Map([...owners].filter(([, users]) => users.size > 1).map(([key, users]) => [key, [...users]]));
	}
}

const potFields = {
	id: true,
	status: true,
	currency: true,
	prizeAmountMinorUnits: true,
	potterId: true,
	updatedAt: true,
} as const;
