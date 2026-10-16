import type { MatchStatus } from "@surescore/shared";
import { PrismaSportsEventCacheStore } from "../../modules/sports/cache-repository.js";
import { matchView } from "../../http/views.js";
import type { PageParams } from "../../http/pagination.js";
import type { AppContext } from "../../types.js";

/** One keyset page of cached matches as `{ matches, nextCursor }`. */
export async function matchPage(
	c: AppContext,
	query: { league?: string } & PageParams,
	statuses: readonly MatchStatus[],
	order: "asc" | "desc" = "asc",
) {
	const { items, nextCursor } = await new PrismaSportsEventCacheStore(c.env.DB).listPage({ ...query, statuses, order });
	const now = new Date();
	return c.json({ matches: items.map((record) => matchView(record, now)), nextCursor });
}
