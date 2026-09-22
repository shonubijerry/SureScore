import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { listSupportedCountries } from "@surescore/shared";
import type { AppContext } from "../../types.js";

const countrySchema = z.object({
	code: z.string(),
	name: z.string(),
	currency: z.string(),
	paymentProviderId: z.string(),
	sportsProviderId: z.string(),
	isLaunched: z.boolean(),
});

export class ListCountriesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "List supported countries",
		responses: {
			"200": {
				description: "Supported countries",
				...contentJson(z.object({ countries: z.array(countrySchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		return c.json({ countries: listSupportedCountries() });
	}
}
