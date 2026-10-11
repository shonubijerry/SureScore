import app from "./router.js";
import { createProviderRegistry } from "./providers/registry.js";
import { PrismaSportsEventCacheStore } from "./lib/sports-cache-repository.js";
import { handleTransferBatch, type TransferJob } from "./lib/transfer-queue.js";
import { invalidateStaleEvents, prefetchFixtures, refreshLiveScores } from "./lib/sports-ingestion.js";

// Cron patterns from wrangler.jsonc "triggers.crons".
const FIXTURE_PREFETCH_CRON = "0 */4 * * *";
const LIVE_SCORE_REFRESH_CRON = "*/10 * * * *";

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return app.fetch(request, env, ctx);
	},

	queue(batch: MessageBatch<TransferJob>, env: Env) {
		return handleTransferBatch(batch, env);
	},

	async scheduled(controller: ScheduledController, env: Env) {
		console.log(`Scheduled task triggered: "${controller.cron}"`);

		// Sports provider selection is config-driven (T4.2/T3.5); today every
		// launched country maps to ESPN, but this never hardcodes that fact.
		const registry = createProviderRegistry(env);
		const provider = registry.resolveSportsProviderForCountry("NG");
		console.log(`Resolved sports provider for country NG:`, provider);
		const store = new PrismaSportsEventCacheStore(env.DB);

		if (controller.cron === FIXTURE_PREFETCH_CRON) {
			const result = await prefetchFixtures(provider, store);
			if (result.failures.length > 0) {
				console.warn("Fixture prefetch had provider failures, serving cached data:", result.failures);
			}
			return;
		}

		if (controller.cron === LIVE_SCORE_REFRESH_CRON) {
			const result = await refreshLiveScores(provider, store);
			if (result.failures.length > 0) {
				console.warn("Live score refresh had provider failures, serving cached data:", result.failures);
			}
			await invalidateStaleEvents(store);
			return;
		}

		console.warn(`Unhandled cron trigger: "${controller.cron}"`);
	},
};

