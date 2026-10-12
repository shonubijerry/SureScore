// Settlement orchestration (Epic 9). Pure rules live in @surescore/shared
// (settlement, scoring); this module reads persisted predictions, ranks them
// on the regulation-time result, and hands payouts to the transfer queue.
// Re-running is safe: the pot only leaves "Settling" through a compare-and-set
// transition, and every payout job carries a stable idempotency key that the
// queue consumer checks against the immutable ledger.

import { HTTPException } from "hono/http-exception";
import { createDbClient } from "@surescore/db";
import {
	DEFAULT_TIE_BREAKS,
	distributePrizes,
	rankPredictions,
	regulationOutcome,
	type MatchOutcome,
	type PayoutRequest,
} from "@surescore/shared";
import { PrismaLedgerStore, type LedgerStore } from "./ledger.js";
import { PotService, SYSTEM_ACTOR } from "./pot-service.js";
import { enqueueTransfers, type TransferJob } from "./transfer-queue.js";

export const payoutKey = (potId: string, userId: string) => `payout:${potId}:${userId}`;

interface TransferRow {
	entryKey: string;
	idempotencyKey: string;
	type: string;
	status: string;
	userId: string;
	amountMinorUnits: number;
	reference: string | null;
	detail: string | null;
}

/** Attempt number encoded in a ledger `entryKey` ("{idempotencyKey}:{attempt}"). */
export const attemptOf = (row: Pick<TransferRow, "entryKey">) => Number(row.entryKey.split(":").pop());

/** Current state of each financial action: its highest-numbered ledger attempt. */
export function latestPerAction<T extends Pick<TransferRow, "entryKey" | "idempotencyKey">>(rows: T[]): T[] {
	const latest = new Map<string, T>();
	for (const row of rows) {
		const seen = latest.get(row.idempotencyKey);
		if (!seen || attemptOf(row) > attemptOf(seen)) latest.set(row.idempotencyKey, row);
	}
	return [...latest.values()];
}

/** The account a payout goes to: the user's default in the pot's country, else any account there. */
export const pickPayoutAccount = <T extends { countryCode: string; isDefault: boolean }>(accounts: T[], countryCode: string) =>
	accounts.find((a) => a.countryCode === countryCode && a.isDefault) ?? accounts.find((a) => a.countryCode === countryCode);

export class SettlementService {
	private readonly db;

	constructor(
		private readonly env: Env,
		private readonly pots = new PotService(env),
		private readonly ledger: LedgerStore = new PrismaLedgerStore(env.DB),
	) {
		this.db = createDbClient(env.DB);
	}

	/** Cron entry point: settles every pot whose official result has arrived. */
	async settleAll() {
		const pots = await this.db.pot.findMany({ where: { status: "Settling" }, select: { id: true } });
		for (const { id } of pots) {
			try {
				await this.settle(id);
			} catch (error) {
				console.error("Settlement failed, will retry on next run:", id, error);
			}
		}
	}

	/** Returns true when the pot was settled by this call. */
	async settle(potId: string) {
		const pot = await this.db.pot.findUnique({
			where: { id: potId },
			include: {
				event: true,
				predictions: { orderBy: { createdAt: "asc" }, include: { user: { include: { payoutAccounts: true } } } },
			},
		});
		if (!pot || pot.status !== "Settling") return false;

		// A manual override (T10.5) replaces the cached provider result.
		const override = await this.db.settlementOverride.findUnique({ where: { potId } });
		const outcome = override
			? {
					home: override.homeGoals,
					away: override.awayGoals,
					firstGoalMinute: override.firstGoalMinute,
					underdog: pot.event.underdog as MatchOutcome["underdog"],
				}
			: regulationOutcome(pot.event);
		if (!outcome) return false;

		if (pot.predictions.length === 0) {
			return this.pots.cancel(pot, SYSTEM_ACTOR, "cancelled");
		}

		const ranked = rankPredictions(
			pot.predictions.map((prediction) => ({
				item: prediction,
				pick: { home: prediction.homeGoals, away: prediction.awayGoals, firstGoalMinute: prediction.firstGoalMinute },
			})),
			outcome,
			{ tieBreaks: DEFAULT_TIE_BREAKS },
		);

		const jobs: TransferJob[] = [];
		for (const { entry, amountMinorUnits } of distributePrizes(ranked, pot.winnerCount, pot.prizeAmountMinorUnits)) {
			const { user } = entry.item;
			const account = pickPayoutAccount(user.payoutAccounts, pot.countryCode);
			const base = {
				potId: pot.id,
				userId: user.id,
				countryCode: pot.countryCode,
				currency: pot.currency,
				amountMinorUnits,
				idempotencyKey: payoutKey(pot.id, user.id),
			};
			if (account) {
				jobs.push({ type: "payout", request: { ...base, payoutAccountId: account.id } satisfies PayoutRequest });
			} else {
				// Surfaces to admins/user as a failed payout to retry once details are added.
				await this.ledger.append({
					...base,
					type: "payout",
					status: "failed",
					provider: pot.provider,
					attempt: 0,
					detail: "No payout account on file",
				});
			}
		}

		// Queue first, then close the state: a crash in between only repeats idempotent sends.
		if (jobs.length > 0) await enqueueTransfers(this.env, jobs);
		return this.pots.transition(pot, "Paid", SYSTEM_ACTOR, `payouts initiated for ${ranked.length} players`);
	}

	/** Refund and payout status for a pot: the potter sees everything, a player only their own payout. */
	async status(userId: string, potId: string) {
		const pot = await this.db.pot.findUnique({
			where: { id: potId },
			select: { id: true, status: true, currency: true, potterId: true, predictions: { where: { userId }, select: { id: true } } },
		});
		if (!pot) throw new HTTPException(404, { message: "Pot not found." });
		const isPotter = pot.potterId === userId;
		if (!isPotter && pot.predictions.length === 0) throw new HTTPException(403, { message: "Not your pot." });

		const rows = await this.db.ledgerEntry.findMany({
			where: { potId, type: { in: ["payout", "refund"] } },
			include: { user: { select: { displayName: true } } },
		});
		const actions = latestPerAction(rows);
		const view = ({ type, user, userId: ownerId, status, amountMinorUnits, reference, detail }: (typeof rows)[number]) => ({
			type,
			userId: ownerId,
			displayName: user.displayName,
			status,
			amountMinorUnits,
			reference,
			detail,
		});

		return {
			potId,
			potStatus: pot.status,
			currency: pot.currency,
			refund: isPotter ? (actions.filter((a) => a.type === "refund").map(view)[0] ?? null) : null,
			payouts: actions.filter((a) => a.type === "payout" && (isPotter || a.userId === userId)).map(view),
		};
	}
}
