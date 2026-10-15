// Removes old matches from the sports cache so it doesn't grow forever.
// A match is removed once its kickoff is MATCH_RETENTION_DAYS in the past
// (finished, postponed, abandoned, stuck, or dropped from the provider feed),
// unless it has a valid pot: one that was paid for. Paid pots and their match
// are kept forever, since their history, payouts and refunds depend on them.
// Unpaid pots on a removed match (never-paid drafts, cancelled before
// funding) are removed with it, with their state history. Ledger rows are
// never deleted: the ledger is append-only, so any pending/failed funding
// attempt for those pots stays on record.

import { createDbClient } from "@surescore/db";
import { inChunks } from "../../platform/chunk.js";
import { log } from "../../platform/logger.js";

export const MATCH_RETENTION_DAYS = 7;
const DAY_MS = 86_400_000;

/** Pot states that are only reachable after funding succeeded. */
const FUNDED_STATUSES = ["Funded", "Open", "Locked", "Live", "Settling", "Paid", "Refunded", "Disputed"];

export interface MatchCleanupResult {
	removedMatches: number;
	removedPots: number;
	/** Old matches kept because one of their pots was paid for. */
	keptForPaidPots: number;
}

export async function pruneOldMatches(database: D1Database, now = new Date()): Promise<MatchCleanupResult> {
	const db = createDbClient(database);
	const cutoff = new Date(now.getTime() - MATCH_RETENTION_DAYS * DAY_MS);

	const candidates = await db.sportsEventCache.findMany({ where: { kickoffTimeUtc: { lt: cutoff } }, select: { id: true } });
	if (candidates.length === 0) return { removedMatches: 0, removedPots: 0, keptForPaidPots: 0 };

	const pots = await inChunks(
		candidates.map((c) => c.id),
		(ids) => db.pot.findMany({ where: { eventId: { in: ids } }, select: { id: true, eventId: true, status: true } }),
	);
	const potIds = pots.map((p) => p.id);
	const [paidFunds, predicted] = await Promise.all([
		inChunks(potIds, (ids) =>
			db.ledgerEntry.findMany({ where: { potId: { in: ids }, type: "fund", status: "successful" }, select: { potId: true } }),
		),
		// Predictions only exist on funded pots; checked anyway, as they also block deleting the pot.
		inChunks(potIds, (ids) => db.prediction.findMany({ where: { potId: { in: ids } }, select: { potId: true }, distinct: ["potId"] })),
	]);

	// A pot is valid (paid for) if the ledger shows a successful funding, or its state proves funding happened.
	const paid = new Set([...paidFunds.map((f) => f.potId), ...predicted.map((p) => p.potId)]);
	for (const pot of pots) if (FUNDED_STATUSES.includes(pot.status)) paid.add(pot.id);

	const protectedEvents = new Set(pots.filter((p) => paid.has(p.id)).map((p) => p.eventId));
	const removableEvents = candidates.map((c) => c.id).filter((id) => !protectedEvents.has(id));
	const removablePots = pots.filter((p) => !protectedEvents.has(p.eventId)).map((p) => p.id);

	// Children first: transitions reference pots, pots reference matches.
	await inChunks(removablePots, async (ids) => [await db.potStateTransition.deleteMany({ where: { potId: { in: ids } } })]);
	await inChunks(removablePots, async (ids) => [await db.pot.deleteMany({ where: { id: { in: ids } } })]);
	await inChunks(removableEvents, async (ids) => [await db.sportsEventCache.deleteMany({ where: { id: { in: ids } } })]);

	const result = { removedMatches: removableEvents.length, removedPots: removablePots.length, keptForPaidPots: protectedEvents.size };
	log.info("sync", "old_matches_pruned", { ...result });
	return result;
}
