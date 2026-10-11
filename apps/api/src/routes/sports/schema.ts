import { z } from "zod";

export const sportsEventSchema = z.object({
	id: z.string(),
	provider: z.string(),
	league: z.string(),
	homeTeam: z.string(),
	awayTeam: z.string(),
	kickoffTimeUtc: z.string(),
	status: z.enum(["scheduled", "first half", "second half", "half time", "finished", "postponed", "abandoned"]),
	homeScore: z.number().nullable(),
	awayScore: z.number().nullable(),
	isFinalResultOfficial: z.boolean(),
	freshness: z.enum(["live", "cached", "stale"]),
	lastRefreshedAt: z.string(),
});
