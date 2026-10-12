import { OpenAPIRoute, NotFoundException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { pageArgs, pageQuery, toPage } from "../../lib/pagination.js";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../lib/views.js";
import { potCardSchema } from "../pots/schema.js";

// Pots people can still browse; Draft (unfunded) and settled/cancelled pots stay out of discovery.
const DISCOVERABLE_STATUSES = ["Open", "Locked", "Live"];

export class ListPublicPotsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "List public pots, optionally filtered by match kickoff date, match or country",
		request: {
			query: z.object({
				from: z.iso.datetime().optional().describe("Kickoff on or after (ISO datetime)"),
				to: z.iso.datetime().optional().describe("Kickoff on or before (ISO datetime)"),
				eventId: z.string().optional().describe("Only pots for this match cache id"),
				countryCode: z.string().length(2).optional(),
				...pageQuery,
			}),
		},
		responses: {
			"200": { description: "Pots by kickoff", ...contentJson(z.object({ pots: z.array(potCardSchema), nextCursor: z.string().nullable() })) },
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const kickoff = {
			...(query.from && { gte: new Date(query.from) }),
			...(query.to && { lte: new Date(query.to) }),
		};
		const rows = await createDbClient(c.env.DB).pot.findMany({
			where: {
				status: { in: DISCOVERABLE_STATUSES },
				...(query.eventId && { eventId: query.eventId }),
				...(query.countryCode && { countryCode: query.countryCode.toUpperCase() }),
				...(Object.keys(kickoff).length && { event: { kickoffTimeUtc: kickoff } }),
			},
			include: potCardInclude,
			orderBy: [{ event: { kickoffTimeUtc: "asc" } }, { createdAt: "desc" }, { id: "asc" }],
			...pageArgs(query),
		});
		const { items, nextCursor } = toPage(rows, query.limit);
		const now = new Date();
		return c.json({ pots: items.map((pot) => potCard(pot, now)), nextCursor });
	}
}

export class GetPublicPotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "Public pot detail: prize, match state and live score",
		request: { params: z.object({ id: z.string() }) },
		responses: {
			"200": { description: "Pot", ...contentJson(z.object({ pot: potCardSchema })) },
			...NotFoundException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const pot = await createDbClient(c.env.DB).pot.findUnique({ where: { id: params.id }, include: potCardInclude });
		if (!pot || pot.status === "Draft") throw new NotFoundException("Pot not found.");
		return c.json({ pot: potCard(pot) });
	}
}
