import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";

const entrySchema = z.object({
	id: z.string(),
	type: z.string(),
	status: z.string(),
	potId: z.string(),
	currency: z.string(),
	amountMinorUnits: z.number().int(),
	provider: z.string(),
	reference: z.string().nullable(),
	createdAt: z.iso.datetime(),
});

export class GetWalletEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Wallet"],
		summary: "Ledger history and settled totals for the current user",
		responses: {
			"200": {
				description: "Wallet",
				...contentJson(
					z.object({
						totals: z.array(
							z.object({ type: z.string(), currency: z.string(), amountMinorUnits: z.number().int() }),
						),
						entries: z.array(entrySchema),
					}),
				),
			},
		},
	};

	async handle(c: AppContext) {
		const db = createDbClient(c.env.DB);
		const userId = c.get("userId");

		const [entries, sums] = await Promise.all([
			db.ledgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
			db.ledgerEntry.groupBy({
				by: ["type", "currency"],
				where: { userId, status: "successful" },
				_sum: { amountMinorUnits: true },
			}),
		]);

		return c.json({
			totals: sums.map((s) => ({ type: s.type, currency: s.currency, amountMinorUnits: s._sum.amountMinorUnits ?? 0 })),
			entries,
		});
	}
}
