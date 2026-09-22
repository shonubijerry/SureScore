import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { sportsProviderConfigs } from "@surescore/shared";
import type { AppContext } from "../../types.js";

const sportsProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	leagues: z.array(z.string()),
});

export class ListSportsProvidersEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "List configured sports data providers",
		responses: {
			"200": {
				description: "Sports providers",
				...contentJson(z.object({ sportsProviders: z.array(sportsProviderSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		return c.json({ sportsProviders: sportsProviderConfigs });
	}
}
