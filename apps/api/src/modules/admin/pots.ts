// Admin pot operations (T10.1, T10.5, T10.6): state dashboard, disputes,
// manual settlement override and audit notes. Every mutation writes an
// AdminAuditLog row with its mandatory reason, and pot state changes go
// through PotService.transition so the lifecycle audit trail stays single-sourced.

import { recordAudit, type AuditAction } from "./audit.js";
import { createDbClient, type Pot } from "@surescore/db";
import type { PotStatus } from "@surescore/shared";
import { fail, PotService, type Actor } from "./pot-service.js";
import { SettlementService } from "./settlement-service.js";
import { pageArgs, toPage } from "./pagination.js";

export interface OverrideInput {
	homeGoals: number;
	awayGoals: number;
	firstGoalMinute?: number;
	reason: string;
}

const OVERRIDABLE: PotStatus[] = ["Live", "Settling", "Disputed"];

export class AdminPotService {
	private readonly db;

	constructor(
		private readonly env: Env,
		private readonly pots = new PotService(env),
		private readonly settlement = new SettlementService(env, pots),
	) {
		this.db = createDbClient(env.DB);
	}

	audit(actorId: string, action: AuditAction, reason: string, target: { potId?: string; subject?: string } = {}) {
		return recordAudit(this.db, actorId, action, reason, target);
	}

	async summary() {
		const rows = await this.db.pot.groupBy({
			by: ["status", "currency"],
			_count: { _all: true },
			_sum: { prizeAmountMinorUnits: true },
		});
		return rows.map((r) => ({
			status: r.status,
			currency: r.currency,
			count: r._count._all,
			prizeMinorUnits: r._sum.prizeAmountMinorUnits ?? 0,
		}));
	}

	async list({ status, limit, cursor }: { status?: string; limit?: number; cursor?: string }) {
		const rows = await this.db.pot.findMany({
			where: status ? { status } : {},
			include: { event: { select: { homeTeam: true, awayTeam: true, kickoffTimeUtc: true, status: true } } },
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
			...pageArgs({ limit, cursor }),
		});
		return toPage(rows, limit);
	}

	async detail(potId: string) {
		const pot = await this.requirePot(potId);
		const [event, transitions, notes, override, ledger, predictionCount] = await Promise.all([
			this.db.sportsEventCache.findUniqueOrThrow({ where: { id: pot.eventId } }),
			this.db.potStateTransition.findMany({ where: { potId }, orderBy: { createdAt: "asc" } }),
			this.db.adminAuditLog.findMany({ where: { potId }, orderBy: { createdAt: "desc" }, take: 100 }),
			this.db.settlementOverride.findUnique({ where: { potId } }),
			this.db.ledgerEntry.findMany({ where: { potId }, orderBy: { createdAt: "desc" }, take: 100 }),
			this.db.prediction.count({ where: { potId } }),
		]);
		return { pot, event, transitions, notes, override, ledger, predictionCount };
	}

	async addNote(adminId: string, potId: string, note: string) {
		await this.requirePot(potId);
		await this.audit(adminId, "note", note, { potId });
	}

	/** Freezes a pot awaiting or after payout; settlement skips it while it is Disputed. */
	async openDispute(adminId: string, potId: string, reason: string) {
		const pot = await this.requirePot(potId);
		if (!["Settling", "Paid"].includes(pot.status)) fail(409, "Only settling or paid pots can be disputed.");
		if (!(await this.pots.transition(pot, "Disputed", this.actor(adminId), reason))) fail(409, "Pot changed state; retry.");
		await this.audit(adminId, "dispute.open", reason, { potId });
	}

	/** Returns a disputed pot to the state it was frozen from. */
	async resolveDispute(adminId: string, potId: string, note: string) {
		const pot = await this.requirePot(potId);
		if (pot.status !== "Disputed") fail(409, "Pot is not disputed.");
		const origin = await this.disputeOrigin(potId);
		if (!(await this.pots.transition(pot, origin, this.actor(adminId), `dispute resolved: ${note}`))) {
			fail(409, "Pot changed state; retry.");
		}
		await this.audit(adminId, "dispute.resolve", note, { potId });
	}

	/**
	 * Settles a pot on an admin-entered regulation score. Not allowed once
	 * payouts were issued (a dispute raised from Paid), since money already left.
	 */
	async overrideSettlement(adminId: string, potId: string, input: OverrideInput) {
		const pot = await this.requirePot(potId);
		if (!OVERRIDABLE.includes(pot.status as PotStatus)) fail(409, `A ${pot.status} pot cannot be overridden.`);
		if (pot.status === "Disputed" && (await this.disputeOrigin(potId)) === "Paid") {
			fail(409, "Payouts were already issued for this pot.");
		}
		if (await this.db.settlementOverride.findUnique({ where: { potId } })) fail(409, "Pot already has an override.");

		const { reason, ...score } = input;
		await this.db.settlementOverride.create({ data: { potId, adminId, reason, ...score } });
		await this.audit(adminId, "settlement.override", reason, {
			potId,
			subject: `${input.homeGoals}-${input.awayGoals}`,
		});

		if (pot.status !== "Settling") {
			if (!(await this.pots.transition(pot, "Settling", this.actor(adminId), `settlement override: ${reason}`))) {
				fail(409, "Pot changed state; retry.");
			}
		}
		return { settled: await this.settlement.settle(potId) };
	}

	private actor = (adminId: string): Actor => ({ type: "admin", id: adminId });

	private async requirePot(potId: string): Promise<Pot> {
		return (await this.db.pot.findUnique({ where: { id: potId } })) ?? fail(404, "Pot not found.");
	}

	private async disputeOrigin(potId: string): Promise<PotStatus> {
		const opened = await this.db.potStateTransition.findFirst({
			where: { potId, toStatus: "Disputed" },
			orderBy: { createdAt: "desc" },
		});
		return (opened?.fromStatus as PotStatus | null) ?? "Settling";
	}
}
