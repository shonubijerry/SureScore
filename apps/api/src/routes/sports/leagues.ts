import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { DEFAULT_COUNTRY_CODE, getCountryConfig, resolveSportsProviderForCountry } from "@surescore/shared";
import type { AppContext } from "../../types.js";
import { leagueSchema } from "./schema.js";

export class ListLeaguesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Sports"],
		summary: "Leagues supported by a country's sports data provider, with logos",
		request: {
			query: z.object({ countryCode: z.string().length(2).optional().describe("Defaults to the launch market") }),
		},
		responses: {
			"200": {
				description: "Leagues in display order",
				...contentJson(z.object({ provider: z.string(), leagues: z.array(leagueSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const country = (query.countryCode && getCountryConfig(query.countryCode)) || getCountryConfig(DEFAULT_COUNTRY_CODE)!;
		const provider = resolveSportsProviderForCountry(country.code);
		return c.json({ provider: provider.id, leagues: provider.leagues ?? [] });
	}
}
