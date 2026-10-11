import { OpenAPIRoute, contentJson, NotFoundException } from "chanfana";
import { z } from "zod";
import { PrismaSportsEventCacheStore } from "../../lib/sports-cache-repository.js";
import { matchView } from "../../lib/views.js";
import type { AppContext } from "../../types.js";
import { sportsEventSchema } from "./schema.js";

export class GetMatchDetailEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "Get a single cached match by cache id ('{provider}:{externalId}')",
		request: {
			params: z.object({
				id: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Match detail",
				...contentJson(z.object({ match: sportsEventSchema })),
			},
			...NotFoundException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const store = new PrismaSportsEventCacheStore(c.env.DB);
		const record = await store.getById(params.id);

		if (!record) {
			throw new NotFoundException(`No match found for id "${params.id}"`);
		}

		return c.json({ match: matchView(record) });
	}
}
