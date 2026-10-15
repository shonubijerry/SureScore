import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { SettlementService } from "../../modules/pots/settlement-service.js";
import type { AppContext } from "../../types.js";
import { potIdParams } from "./schema.js";

const transferSchema = z.object({
	type: z.enum(["payout", "refund"]),
	userId: z.string(),
	displayName: z.string().nullable(),
	status: z.enum(["pending", "successful", "failed"]),
	amountMinorUnits: z.number().int(),
	reference: z.string().nullable(),
	detail: z.string().nullable(),
});

export class GetPotSettlementEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Payout and refund status for a pot (potter: all; player: own payout)",
		request: { params: potIdParams },
		responses: {
			"200": {
				description: "Settlement status",
				...contentJson(
					z.object({
						potId: z.string(),
						potStatus: z.string(),
						currency: z.string(),
						refund: transferSchema.nullable(),
						payouts: z.array(transferSchema),
					}),
				),
			},
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new SettlementService(c.env).status(c.get("userId"), params.id));
	}
}
