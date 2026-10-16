import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { paginateArray, pageQuery, type SortOrder } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { toRecord } from "../../modules/sports/cache-repository.js";
import { matchView } from "../../http/views.js";
import { sportsEventSchema } from "../sports/schema.js";

/** Size of the popular set: the most prominent upcoming matches. */
const MAX_POPULAR = 20;

const byKickoff: SortOrder = [
	{ path: "kickoffTimeUtc", dir: "asc", type: "date" },
	{ path: "id", dir: "asc" },
];

export class ListPopularMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "The most prominent upcoming matches (provider-signalled importance), soonest kickoff first",
		request: { query: z.object(pageQuery) },
		responses: {
			"200": {
				description: "Popular matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema.extend({ potCount: z.number().int() })), nextCursor: z.string().nullable() })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const db = createDbClient(c.env.DB);
		const now = new Date();
		const events = await db.sportsEventCache.findMany({
			where: { status: "scheduled", kickoffTimeUtc: { gt: now } },
			orderBy: [{ importance: "desc" }, { kickoffTimeUtc: "asc" }, { id: "asc" }],
			take: MAX_POPULAR,
			include: { _count: { select: { pots: { where: { status: "Open", isPrivate: false } } } } },
		});
		// Importance picks which matches are popular; they are listed by date, and a page is a window of that fixed set.
		events.sort((a, b) => a.kickoffTimeUtc.getTime() - b.kickoffTimeUtc.getTime() || a.id.localeCompare(b.id));
		const { items, nextCursor } = paginateArray(events, byKickoff, query);
		return c.json({
			matches: items.map((event) => ({ ...matchView(toRecord(event), now), potCount: event._count.pots })),
			nextCursor,
		});
	}
}
