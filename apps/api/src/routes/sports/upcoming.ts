import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { computeFreshness } from "@surescore/shared";
import { PrismaSportsEventCacheStore } from "../../lib/sports-cache-repository.js";
import type { AppContext } from "../../types.js";
import { sportsEventSchema } from "./schema.js";

export class ListUpcomingMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "List upcoming (scheduled) matches from the sports data cache",
		request: {
			query: z.object({
				league: z.string().optional(),
			}),
		},
		responses: {
			"200": {
				description: "Upcoming matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const store = new PrismaSportsEventCacheStore(c.env.DB);
		const records = await store.listUpcoming(query.league);
		const now = new Date();

		const matches = records.map((record) => ({
			...record,
			freshness: computeFreshness(record.status, record.lastRefreshedAt, now),
		}));

		return c.json({ matches });
	}
}
