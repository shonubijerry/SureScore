import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { pageArgs, pageQuery, toPage } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../http/views.js";
import { potCardSchema } from "./schema.js";

export class ListPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "List the current user's pots: ones they created and/or ones they predicted on, newest first",
		request: {
			query: z.object({
				role: z
					.enum(["all", "created", "predicted"])
					.default("created")
					.describe("created: pots the user funded; predicted: other potters' pots the user predicted on; all: both"),
				includeCancelled: z
					.enum(["true", "false"])
					.default("false")
					.describe("Include cancelled and refunded pots (hidden by default)"),
				...pageQuery,
			}),
		},
		responses: {
			"200": {
				description: "Pots, newest first",
				...contentJson(
					z.object({
						pots: z.array(
							potCardSchema.extend({
								isPotter: z.boolean().describe("The current user created this pot"),
								myPrediction: z
									.object({ homeGoals: z.number().int(), awayGoals: z.number().int(), firstGoalMinute: z.number().int().nullable() })
									.nullable()
									.describe("The current user's pick in this pot, if they predicted"),
							}),
						),
						nextCursor: z.string().nullable(),
					}),
				),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const userId = c.get("userId");
		const created = { potterId: userId };
		const predicted = { potterId: { not: userId }, predictions: { some: { userId } } };
		const rows = await createDbClient(c.env.DB).pot.findMany({
			where: {
				...(query.role === "created" ? created : query.role === "predicted" ? predicted : { OR: [created, predicted] }),
				...(query.includeCancelled === "false" && { status: { notIn: ["Cancelled", "Refunded"] } }),
			},
			include: {
				...potCardInclude,
				predictions: { where: { userId }, select: { homeGoals: true, awayGoals: true, firstGoalMinute: true }, take: 1 },
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs(query),
		});
		const { items, nextCursor } = toPage(rows, query.limit);
		const now = new Date();
		return c.json({
			nextCursor,
			pots: items.map((pot) => ({ ...potCard(pot, now), isPotter: pot.potterId === userId, myPrediction: pot.predictions[0] ?? null })),
		});
	}
}
