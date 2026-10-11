import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";
import { potSchema } from "./schema.js";

export class ListPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Pots"],
		summary: "List pots created by the current user",
		responses: {
			"200": { description: "Pots", ...contentJson(z.object({ pots: z.array(potSchema) })) },
		},
	};

	async handle(c: AppContext) {
		const pots = await createDbClient(c.env.DB).pot.findMany({
			where: { potterId: c.get("userId") },
			orderBy: { createdAt: "desc" },
		});
		return c.json({ pots });
	}
}
