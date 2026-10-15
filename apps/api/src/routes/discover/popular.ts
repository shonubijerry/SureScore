import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { pageQuery } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { toRecord } from "../../modules/sports/cache-repository.js";
import { matchView } from "../../http/views.js";
import { sportsEventSchema } from "../sports/schema.js";

/** Size of the popular set: the most prominent upcoming matches. */
const MAX_POPULAR = 20;

export class ListPopularMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "The most prominent upcoming matches (provider-signalled importance), soonest kickoff first",
		request: { query: z.object({ ...pageQuery, cursor: z.string().optional().describe("Cache id of the last match on the previous page") }) },
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
		// Importance picks which matches are popular; they are listed by date.
		events.sort((a, b) => a.kickoffTimeUtc.getTime() - b.kickoffTimeUtc.getTime() || a.id.localeCompare(b.id));
		const start = query.cursor ? events.findIndex((e) => e.id === query.cursor) + 1 : 0;
		const page = events.slice(start, start + query.limit);
		const hasMore = start + query.limit < events.length;
		return c.json({
			matches: page.map((event) => ({ ...matchView(toRecord(event), now), potCount: event._count.pots })),
			nextCursor: hasMore ? page[page.length - 1].id : null,
		});
	}
}
