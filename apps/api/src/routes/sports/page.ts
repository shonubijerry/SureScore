import type { MatchStatus } from "@surescore/shared";
import { PrismaSportsEventCacheStore } from "../../modules/sports/cache-repository.js";
import { matchView } from "../../http/views.js";
import type { AppContext } from "../../types.js";

/** One page of cached matches as `{ matches, nextCursor }`; the cursor is the last match's cache id. */
export async function matchPage(
	c: AppContext,
	query: { league?: string; limit: number; cursor?: string },
	statuses: readonly MatchStatus[],
	order: "asc" | "desc" = "asc",
) {
	const rows = await new PrismaSportsEventCacheStore(c.env.DB).listPage({ ...query, statuses, order, limit: query.limit + 1 });
	const records = rows.slice(0, query.limit);
	const last = records[records.length - 1];
	const now = new Date();
	return c.json({
		matches: records.map((record) => matchView(record, now)),
		nextCursor: rows.length > query.limit ? `${last.provider}:${last.id}` : null,
	});
}
