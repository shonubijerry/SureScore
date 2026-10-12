import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { PrismaSportsEventCacheStore } from "../../lib/sports-cache-repository.js";
import { matchView } from "../../lib/views.js";
import { pageQuery } from "../../lib/pagination.js";
import type { AppContext } from "../../types.js";
import { sportsEventSchema } from "./schema.js";

export class ListUpcomingMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "List upcoming (scheduled) matches from the sports data cache",
		request: {
			query: z.object({
				league: z.string().optional(),
				...pageQuery,
			}),
		},
		responses: {
			"200": {
				description: "Upcoming matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema), nextCursor: z.string().nullable() })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const store = new PrismaSportsEventCacheStore(c.env.DB);
		const rows = await store.listUpcoming(query.league, query.limit + 1, query.cursor);
		const records = rows.slice(0, query.limit);
		const last = records[records.length - 1];
		const now = new Date();
		return c.json({
			matches: records.map((record) => matchView(record, now)),
			nextCursor: rows.length > query.limit ? `${last.provider}:${last.id}` : null,
		});
	}
}
