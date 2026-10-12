import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { pageArgs, pageQuery, toPage } from "../../lib/pagination.js";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../lib/views.js";
import { potCardSchema } from "./schema.js";

export class ListPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "List pots created by the current user",
		request: { query: z.object(pageQuery) },
		responses: {
			"200": { description: "Pots", ...contentJson(z.object({ pots: z.array(potCardSchema), nextCursor: z.string().nullable() })) },
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const rows = await createDbClient(c.env.DB).pot.findMany({
			where: { potterId: c.get("userId") },
			include: potCardInclude,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			...pageArgs(query),
		});
		const { items, nextCursor } = toPage(rows, query.limit);
		const now = new Date();
		return c.json({ pots: items.map((pot) => potCard(pot, now)), nextCursor });
	}
}
