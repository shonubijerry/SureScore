import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { liveMatchStatuses } from "@surescore/shared";
import { paginate, pageQuery, type SortOrder } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../http/views.js";
import { potCardSchema } from "./schema.js";

const byKickoff: SortOrder = [
	{ path: "pot.event.kickoffTimeUtc", dir: "asc", type: "date" },
	{ path: "id", dir: "asc" },
];

export class ListPredictedPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Predictions"],
		summary: "Upcoming and live matches the current user has predicted, with their picks",
		request: { query: z.object(pageQuery) },
		responses: {
			"200": {
				description: "Predictions with their pots, soonest kickoff first",
				...contentJson(
					z.object({
						predictions: z.array(
							z.object({
								homeGoals: z.number().int(),
								awayGoals: z.number().int(),
								firstGoalMinute: z.number().int().nullable(),
								pot: potCardSchema,
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
		const where = {
			userId: c.get("userId"),
			pot: {
				status: { notIn: ["Draft", "Cancelled", "Refunded"] },
				event: { status: { in: ["scheduled", ...liveMatchStatuses] } },
			},
		};
		const { items, nextCursor } = await paginate(byKickoff, query, where, (args) =>
			createDbClient(c.env.DB).prediction.findMany({ ...args, include: { pot: { include: potCardInclude } } }),
		);
		const now = new Date();
		return c.json({
			nextCursor,
			predictions: items.map(({ pot, homeGoals, awayGoals, firstGoalMinute }) => ({
				homeGoals,
				awayGoals,
				firstGoalMinute,
				pot: potCard(pot, now),
			})),
		});
	}
}
