import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../lib/views.js";
import { potCardSchema } from "./schema.js";

export class ListPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "List pots created by the current user",
		responses: {
			"200": { description: "Pots", ...contentJson(z.object({ pots: z.array(potCardSchema) })) },
		},
	};

	async handle(c: AppContext) {
		const pots = await createDbClient(c.env.DB).pot.findMany({
			where: { potterId: c.get("userId") },
			include: potCardInclude,
			orderBy: { createdAt: "desc" },
		});
		const now = new Date();
		return c.json({ pots: pots.map((pot) => potCard(pot, now)) });
	}
}
