import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { paymentProviderConfigs } from "@surescore/shared";
import type { AppContext } from "../../types.js";

const paymentProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	countries: z.array(z.string()),
});

export class ListPaymentProvidersEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Config"],
		summary: "List configured payment providers",
		responses: {
			"200": {
				description: "Payment providers",
				...contentJson(z.array(paymentProviderSchema)),
			},
		},
	};

	async handle(c: AppContext) {
		return c.json(paymentProviderConfigs);
	}
}
