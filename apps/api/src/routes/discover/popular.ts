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
		summary: "Upcoming matches ranked by number of open pots",
		request: { query: z.object({ countryCode: z.string().length(2).optional() }) },
		responses: {
			"200": {
				description: "Popular matches",
				...contentJson(z.object({ matches: z.array(sportsEventSchema.extend({ potCount: z.number().int() })) })),
			},
		},
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const db = createDbClient(c.env.DB);
		const now = new Date();

		const groups = await db.pot.groupBy({
			by: ["eventId"],
			where: {
				status: "Open",
				event: { kickoffTimeUtc: { gt: now } },
				...(query.countryCode && { countryCode: query.countryCode.toUpperCase() }),
			},
			_count: { _all: true },
			orderBy: { _count: { eventId: "desc" } },
			take: MAX_POPULAR,
		});
		const events = await db.sportsEventCache.findMany({ where: { id: { in: groups.map((g) => g.eventId) } } });
		const byId = new Map(events.map((event) => [event.id, event]));

		const matches = groups.flatMap((group) => {
			const event = byId.get(group.eventId);
			return event ? [{ ...matchView(toRecord(event), now), potCount: group._count._all }] : [];
		});
		return c.json({ matches });
	}
}
