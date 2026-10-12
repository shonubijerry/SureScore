import { z } from "zod";
import { matchStatuses } from "@surescore/shared";

export const sportsEventSchema = z.object({
	id: z.string(),
	cacheId: z.string().describe("Id to use when creating pots and fetching match detail"),
	provider: z.string(),
	league: z.string(),
	homeTeam: z.string(),
	awayTeam: z.string(),
	kickoffTimeUtc: z.string(),
	status: z.enum(matchStatuses),
	homeScore: z.number().nullable(),
	awayScore: z.number().nullable(),
	isFinalResultOfficial: z.boolean(),
	importance: z.number().int().optional().describe("Provider-signalled prominence; higher is more popular"),
	freshness: z.enum(["live", "cached", "stale"]),
	lastRefreshedAt: z.string(),
});
