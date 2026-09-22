import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";
import { payoutAccountSchema } from "./schema.js";

export class ListPayoutAccountsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Payout Accounts"],
		summary: "List the current user's payout accounts",
		responses: {
			"200": {
				description: "Payout accounts",
				...contentJson(z.object({ payoutAccounts: z.array(payoutAccountSchema) })),
			},
		},
	};

	async handle(c: AppContext) {
		const db = createDbClient(c.env.DB);
		const accounts = await db.payoutAccount.findMany({
			where: { userId: c.get("userId") },
			orderBy: { createdAt: "asc" },
		});
		return c.json({ payoutAccounts: accounts });
	}
}
