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
		summary: "List pots created by the current user",
		request: {
			query: z.object({
				includeCancelled: z
					.enum(["true", "false"])
					.default("false")
					.describe("Include cancelled and refunded pots (hidden by default)"),
				...pageQuery,
			}),
		},
		responses: {
			"200": { description: "Pots", ...contentJson(z.object({ pots: z.array(potCardSchema), nextCursor: z.string().nullable() })) },
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const rows = await createDbClient(c.env.DB).pot.findMany({
			where: {
				potterId: c.get("userId"),
				...(query.includeCancelled === "false" && { status: { notIn: ["Cancelled", "Refunded"] } }),
			},
			include: potCardInclude,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs(query),
		});
		const { items, nextCursor } = toPage(rows, query.limit);
		const now = new Date();
		return c.json({ pots: items.map((pot) => potCard(pot, now)), nextCursor });
	}
}
