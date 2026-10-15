import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { liveMatchStatuses } from "@surescore/shared";
import { pageQuery } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { matchPage } from "./page.js";
import { sportsEventSchema } from "./schema.js";

export class ListLiveMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "List currently live matches from the sports data cache",
		request: { query: z.object({ league: z.string().optional(), ...pageQuery }) },
		responses: {
			"200": {
				description: "Live matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema), nextCursor: z.string().nullable() })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return matchPage(c, query, liveMatchStatuses);
	}
}
