import { OpenAPIRoute, NotFoundException, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import { paginate, pageQuery, type SortOrder } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";
import { potCard, potCardInclude } from "../../http/views.js";
import { assertPotAccess } from "../../modules/pots/pot-access.js";
import { potCardSchema } from "../pots/schema.js";

// Pots people can still browse; Draft (unfunded), settled/cancelled and private pots stay out of discovery.
const DISCOVERABLE_STATUSES = ["Open", "Locked", "Live"];

/** Soonest match first; newest pot first within a match. */
const byKickoff: SortOrder = [
	{ path: "event.kickoffTimeUtc", dir: "asc", type: "date" },
	{ path: "createdAt", dir: "desc", type: "date" },
	{ path: "id", dir: "asc" },
];

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
		const where = {
			status: { in: DISCOVERABLE_STATUSES },
			isPrivate: false,
			...(query.eventId && { eventId: query.eventId }),
			...(query.countryCode && { countryCode: query.countryCode.toUpperCase() }),
			...(Object.keys(kickoff).length && { event: { kickoffTimeUtc: kickoff } }),
		};
		const { items, nextCursor } = await paginate(byKickoff, query, where, (args) =>
			createDbClient(c.env.DB).pot.findMany({ ...args, include: potCardInclude }),
		);
		const now = new Date();
		return c.json({ pots: items.map((pot) => potCard(pot, now)), nextCursor });
	}
}

export class GetPublicPotEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "Pot detail: prize, match state and live score. Private pots need the share code, or a signed-in potter/player.",
		request: {
			params: z.object({ id: z.string() }),
			query: z.object({ code: z.string().optional().describe("Share code from the pot's link") }),
		},
		responses: {
			"200": { description: "Pot", ...contentJson(z.object({ pot: potCardSchema })) },
			...NotFoundException.schema(),
		},
	};

	async handle(c: AppContext) {
		const { params, query } = await this.getValidatedData<typeof this.schema>();
		const db = createDbClient(c.env.DB);
		const pot = await db.pot.findUnique({ where: { id: params.id }, include: potCardInclude });
		if (!pot || pot.status === "Draft") throw new NotFoundException("Pot not found.");
		await assertPotAccess(db, pot, { userId: c.get("userId"), shareCode: query.code });
		return c.json({ pot: potCard(pot) });
	}
}
