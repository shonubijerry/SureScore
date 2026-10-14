import { OpenAPIRoute, contentJson } from "chanfana";
import { createDbClient } from "@surescore/db";
import { z } from "zod";
import { AdminOpsService } from "../../lib/admin-ops.js";
import { recordAudit } from "../../lib/audit.js";
import { trackJob } from "../../lib/job-runs.js";
import { PrismaSportsEventCacheStore } from "../../lib/sports-cache-repository.js";
import { prefetchFixtures } from "../../lib/sports-ingestion.js";
import { pageQuery } from "../../lib/pagination.js";
import type { AppContext } from "../../types.js";
import { createProviderRegistry } from "../../providers/registry.js";
import { okResponse, reasonSchema } from "./schema.js";

export class ProviderHealthEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Sports/payment provider health and scheduled-job failures",
		responses: okResponse("Health"),
	};

	async handle(c: AppContext) {
		return c.json(await new AdminOpsService(c.env.DB).health());
	}
}

export class SearchLedgerEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Search ledger history by reference, key, pot, user id or email",
		request: {
			query: z.object({
				q: z.string().optional(),
				type: z.enum(["fund", "refund", "payout"]).optional(),
				status: z.enum(["pending", "successful", "failed"]).optional(),
				currency: z.string().optional(),
				provider: z.string().optional(),
				potId: z.string().optional(),
				userId: z.string().optional(),
				from: z.coerce.date().optional(),
				to: z.coerce.date().optional(),
				...pageQuery,
			}),
		},
		responses: okResponse("Ledger entries"),
	};

	async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		return c.json(await new AdminOpsService(c.env.DB).searchLedger(query));
	}
}

export class SyncScoreboardEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Admin"],
		summary: "Fetch the provider scoreboard for a date and update the sports event cache (backfills missed cron runs)",
		request: {
			body: contentJson(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."), reason: reasonSchema })),
		},
		responses: okResponse("Sync result"),
	};

	async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		await recordAudit(createDbClient(c.env.DB), c.get("userId"), "sports.sync", body.reason, { subject: body.date });
		const provider = createProviderRegistry(c.env).resolveSportsProviderForCountry("NG");
		const store = new PrismaSportsEventCacheStore(c.env.DB);
		let result: Awaited<ReturnType<typeof prefetchFixtures>> | undefined;
		await trackJob(c.env.DB, "scoreboard-backfill", "sports", async () => {
			result = await prefetchFixtures(provider, store, { from: body.date, to: body.date });
			return result;
		});
		return c.json({ date: body.date, ...result });
	}
}
