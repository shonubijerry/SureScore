import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { liveMatchStatuses } from "@surescore/shared";
import { PrismaSportsEventCacheStore } from "../../lib/sports-cache-repository.js";
import { matchView } from "../../lib/views.js";
import type { AppContext } from "../../types.js";
import { sportsEventSchema } from "./schema.js";

export class ListLiveMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "List currently live matches from the sports data cache",
		request: {
			query: z.object({
				league: z.string().optional(),
			}),
		},
		responses: {
			"200": {
				description: "Live matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const store = new PrismaSportsEventCacheStore(c.env.DB);
		const records = await store.listByStatus([...liveMatchStatuses], query.league);
		const now = new Date();
		return c.json({ matches: records.map((record) => matchView(record, now)) });
	}
}
