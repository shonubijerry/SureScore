import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AdminOpsService } from "../../lib/admin-ops.js";
import type { AppContext } from "../../types.js";
import { okResponse, pageQuery } from "./schema.js";

export class ProviderHealthEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Sports/payment provider health and scheduled-job failures",
		responses: okResponse("Health"),
	};

	async handle(c: AppContext) {
		return c.json(await new AdminOpsService(c.env.DB).health());
	}
}

export class SearchLedgerEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Search ledger history by reference, key, pot, user id or email",
		request: {
			query: z.object({
				q: z.string().optional(),
				type: z.enum(["fund", "refund", "payout"]).optional(),
				status: z.enum(["pending", "successful", "failed"]).optional(),
				currency: z.string().optional(),
				provider: z.string().optional(),
				potId: z.string().optional(),
				userId: z.string().optional(),
				from: z.coerce.date().optional(),
				to: z.coerce.date().optional(),
				...pageQuery,
			}),
		},
		responses: okResponse("Ledger entries"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new AdminOpsService(c.env.DB).searchLedger(query));
	}
}
