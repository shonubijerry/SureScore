import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createDbClient } from "@surescore/db";
import type { AppContext } from "../../types.js";
import { toRecord } from "../../lib/sports-cache-repository.js";
import { matchView } from "../../lib/views.js";
import { sportsEventSchema } from "../sports/schema.js";

const MAX_POPULAR = 10;

export class ListPopularMatchesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Discovery"],
		summary: "Upcoming matches ranked by provider-signalled importance, then kickoff",
		responses: {
			"200": {
				description: "Popular matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema.extend({ potCount: z.number().int() })) })),
			},
		},
	};

	async handle(c: AppContext) {
		const db = createDbClient(c.env.DB);
		const now = new Date();
		const events = await db.sportsEventCache.findMany({
			where: { status: "scheduled", kickoffTimeUtc: { gt: now } },
			orderBy: [{ importance: "desc" }, { kickoffTimeUtc: "asc" }, { id: "asc" }],
			take: MAX_POPULAR,
			include: { _count: { select: { pots: { where: { status: "Open" } } } } },
		});
		return c.json({
			matches: events.map((event) => ({ ...matchView(toRecord(event), now), potCount: event._count.pots })),
		});
	}
}
