import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { MAX_WINNER_COUNT, MIN_WINNER_COUNT } from "@surescore/shared";
import { PotService } from "../../modules/pots/pot-service.js";
import type { AppContext } from "../../types.js";
import { potSchema } from "./schema.js";

export class CreatePotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "Create a pot for an eligible match and start funding it",
		request: {
			body: contentJson(
				z.object({
					eventId: z.string().min(1),
					prizeAmountMinorUnits: z.number().int().positive(),
					winnerCount: z.number().int().min(MIN_WINNER_COUNT).max(MAX_WINNER_COUNT),
					refundAccountId: z.string().min(1).describe("Potter's payout account that receives any refund"),
					isPrivate: z.boolean().default(false).describe("Private pots are hidden from discovery and reachable only by share link"),
					callbackUrl: z.string().url().optional(),
				}),
			),
		},
		responses: {
			"201": {
				description: "Pot created; complete payment at checkoutUrl, then verify funding",
				...contentJson(z.object({ pot: potSchema, checkoutUrl: z.string().optional() })),
			},
		},
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await new PotService(c.env).create(c.get("userId"), body);
		return c.json(result, 201);
	}
}
