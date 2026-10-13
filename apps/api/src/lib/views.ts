// Shared response shapes so every route exposes matches and pots identically.

import { computeFreshness, predictionLockTime, teamLogoUrl } from "@surescore/shared";
import type { Pot, SportsEventCache } from "@surescore/db";
import { toRecord, type SportsEventCacheRecord } from "./sports-cache-repository.js";

/** A cached match plus its cache id (the id pots reference) and computed freshness. */
export const matchView = (record: SportsEventCacheRecord, now = new Date()) => ({
	...record,
	cacheId: `${record.provider}:${record.id}`,
	homeTeamLogoUrl: teamLogoUrl(record.provider, record.homeTeamId),
	awayTeamLogoUrl: teamLogoUrl(record.provider, record.awayTeamId),
	freshness: computeFreshness(record.status, record.lastRefreshedAt, now),
});

export const potCardInclude = { event: true, _count: { select: { predictions: true } } } as const;

type PotWithEvent = Pot & { event: SportsEventCache; _count: { predictions: number } };

/** Public-safe pot summary: never exposes potter identity or payment references. */
export const potCard = (pot: PotWithEvent, now = new Date()) => ({
	id: pot.id,
	status: pot.status,
	countryCode: pot.countryCode,
	currency: pot.currency,
	prizeAmountMinorUnits: pot.prizeAmountMinorUnits,
	winnerCount: pot.winnerCount,
	shareCode: pot.shareCode,
	predictionCount: pot._count.predictions,
	predictionLocksAt: predictionLockTime(pot.event.kickoffTimeUtc).toISOString(),
	createdAt: pot.createdAt.toISOString(),
	match: matchView(toRecord(pot.event), now),
});
