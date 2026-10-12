// Admin views of outbound money movement (T10.2-T10.4): the failed-payout
// retry queue and the refund queue share one implementation, since both are
// "latest ledger state per financial action". Retries re-enter the normal
// transfer queue, so the consumer's idempotency and ledger rules still apply.

import { createDbClient } from "@surescore/db";
import type { RefundReason } from "@surescore/shared";
import { fail, PotService } from "./pot-service.js";
import { attemptOf, latestPerAction, pickPayoutAccount } from "./settlement-service.js";
import { enqueueTransfer } from "./transfer-queue.js";
import { inChunks } from "./chunk.js";
import { PAGE_DEFAULT, PAGE_MAX, pageArgs } from "./pagination.js";
import type { LedgerStatus, LedgerType } from "./ledger.js";
import type { AdminPotService } from "./admin-pots.js";

type TransferType = Extract<LedgerType, "payout" | "refund">;

export class AdminTransferService {
	private readonly db;

	constructor(
		private readonly env: Env,
		private readonly adminPots: AdminPotService,
	) {
		this.db = createDbClient(env.DB);
	}

	/** Actions of `type` whose current (latest-attempt) state is `status`, newest first. */
	async queue({ type, status, limit = PAGE_DEFAULT, cursor }: { type: TransferType; status: LedgerStatus; limit?: number; cursor?: string }) {
		const take = Math.min(limit, PAGE_MAX);
		const candidates = await this.db.ledgerEntry.findMany({
			where: { type, status },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs({ limit: take, cursor }),
		});
		const hasMore = candidates.length > take;
		const page = candidates.slice(0, take);
		const keys = [...new Set(page.map((r) => r.idempotencyKey))];

		const history = await inChunks(keys, (chunk) =>
			this.db.ledgerEntry.findMany({ where: { idempotencyKey: { in: chunk } } }),
		);
		const attempts = new Map<string, number>();
		for (const row of history) attempts.set(row.idempotencyKey, (attempts.get(row.idempotencyKey) ?? 0) + 1);
		const current = latestPerAction(history).filter((row) => row.status === status);

		const [users, pots, accounts] = await Promise.all([
			inChunks([...new Set(current.map((r) => r.userId))], (ids) =>
				this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, displayName: true } }),
			),
			inChunks([...new Set(current.map((r) => r.potId))], (ids) =>
				this.db.pot.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } }),
			),
			type === "payout"
				? inChunks([...new Set(current.map((r) => r.userId))], (ids) =>
						this.db.payoutAccount.findMany({ where: { userId: { in: ids } } }),
					)
				: Promise.resolve([]),
		]);
		const userById = new Map(users.map((u) => [u.id, u]));
		const potById = new Map(pots.map((p) => [p.id, p]));

		const items = current
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.map((row) => {
				const account = pickPayoutAccount(
					accounts.filter((a) => a.userId === row.userId),
					row.countryCode,
				);
				return {
					idempotencyKey: row.idempotencyKey,
					type,
					status: row.status,
					potId: row.potId,
					potStatus: potById.get(row.potId)?.status ?? null,
					userId: row.userId,
					email: userById.get(row.userId)?.email ?? null,
					displayName: userById.get(row.userId)?.displayName ?? null,
					currency: row.currency,
					amountMinorUnits: row.amountMinorUnits,
					provider: row.provider,
					reference: row.reference,
					detail: row.detail,
					attempts: attempts.get(row.idempotencyKey) ?? 1,
					lastAttemptAt: row.createdAt,
					// A payout is ready to retry once the user has an account saved after the failure.
					readyToRetry: type === "refund" || (!!account && account.updatedAt > row.createdAt),
					hasPayoutAccount: type === "refund" ? null : !!account,
				};
			});
		return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
	}

	/** Re-queues a failed payout (to the user's current account) or refund. */
	async retry(adminId: string, idempotencyKey: string, reason: string) {
		const rows = await this.db.ledgerEntry.findMany({ where: { idempotencyKey } });
		const [latest] = latestPerAction(rows);
		if (!latest || (latest.type !== "payout" && latest.type !== "refund")) fail(404, "Transfer not found.");
		if (rows.some((r) => r.status === "pending" || r.status === "successful") || latest.status !== "failed") {
			fail(409, "Only failed transfers can be retried.");
		}

		const pot = await this.db.pot.findUnique({ where: { id: latest.potId } });
		if (!pot) fail(404, "Pot not found.");
		const attemptOffset = Math.max(...rows.map(attemptOf)) + 1;

		if (latest.type === "refund") {
			if (pot.status !== "Cancelled") fail(409, `Cannot refund a ${pot.status} pot.`);
			const cancelled = await this.db.potStateTransition.findFirst({
				where: { potId: pot.id, toStatus: "Cancelled" },
				orderBy: { createdAt: "desc" },
			});
			await enqueueTransfer(this.env, {
				...PotService.refundJob(pot, (cancelled?.reason as RefundReason | undefined) ?? "cancelled"),
				attemptOffset,
			});
		} else {
			if (pot.status !== "Paid") fail(409, `Cannot pay out a ${pot.status} pot.`);
			const accounts = await this.db.payoutAccount.findMany({ where: { userId: latest.userId } });
			const account = pickPayoutAccount(accounts, pot.countryCode);
			if (!account) fail(422, "The user has no payout account for this country yet.");
			await enqueueTransfer(this.env, {
				type: "payout",
				attemptOffset,
				request: {
					potId: pot.id,
					userId: latest.userId,
					countryCode: pot.countryCode,
					currency: pot.currency,
					amountMinorUnits: latest.amountMinorUnits,
					payoutAccountId: account.id,
					idempotencyKey,
				},
			});
		}
		await this.adminPots.audit(adminId, "transfer.retry", reason, { potId: pot.id, subject: idempotencyKey });
		return { queued: true };
	}
}
