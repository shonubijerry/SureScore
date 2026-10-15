import app from "./router.js";
import { createProviderRegistry } from "./providers/registry.js";
import { PrismaSportsEventCacheStore } from "./modules/sports/cache-repository.js";
import { PotService } from "./modules/pots/pot-service.js";
import { SettlementService } from "./modules/pots/settlement-service.js";
import { handleTransferBatch, type TransferJob } from "./modules/payments/transfer-queue.js";
import { ReconciliationService } from "./modules/payments/reconciliation-service.js";
import { dispatchAlerts } from "./modules/admin/alerts.js";
import { log } from "./platform/logger.js";
import { pruneJobRuns, trackJob } from "./platform/job-runs.js";
import { invalidateStaleEvents, prefetchFixtures, refreshLiveScores } from "./modules/sports/ingestion.js";
import { pruneOldMatches } from "./modules/sports/cleanup.js";

// Cron patterns from wrangler.jsonc "triggers.crons".
const FIXTURE_PREFETCH_CRON = "0 */4 * * *";
const LIVE_SCORE_REFRESH_CRON = "*/10 * * * *";
const RECONCILIATION_CRON = "0 2 * * *";

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return app.fetch(request, env, ctx);
	},

	queue(batch: MessageBatch<TransferJob>, env: Env) {
		return handleTransferBatch(batch, env, {
			onRefunded: (potId) => new PotService(env).markRefunded(potId),
		});
	},

	async scheduled(controller: ScheduledController, env: Env) {
		log.info("job", "scheduled", { cron: controller.cron });

		// Sports provider selection is config-driven (T4.2/T3.5); today every
		// launched country maps to ESPN, but this never hardcodes that fact.
		const registry = createProviderRegistry(env);
		const provider = registry.resolveSportsProviderForCountry("NG");
		const store = new PrismaSportsEventCacheStore(env.DB);

		if (controller.cron === FIXTURE_PREFETCH_CRON) {
			await trackJob(env.DB, "fixture-prefetch", "sports", () => prefetchFixtures(provider, store));
			// Old matches leave the cache unless one of their pots was paid for.
			await trackJob(env.DB, "match-cleanup", "sports", async () => {
				await pruneOldMatches(env.DB);
			});
			await pruneJobRuns(env.DB).catch((error) => log.error("job", "prune_failed", { error }));
			return;
		}

		if (controller.cron === LIVE_SCORE_REFRESH_CRON) {
			await trackJob(env.DB, "live-refresh", "sports", async () => {
				const result = await refreshLiveScores(provider, store);
				await invalidateStaleEvents(store);
				return result;
			});
			await trackJob(env.DB, "settlement", "payments", async () => {
				const pots = new PotService(env);
				await pots.syncStatuses();
				await new SettlementService(env, pots).settleAll();
			});
			await dispatchAlerts(env).catch((error) => log.error("alert", "dispatch_failed", { error }));
			return;
		}

		if (controller.cron === RECONCILIATION_CRON) {
			await trackJob(env.DB, "reconciliation", "finance", async () => {
				await new ReconciliationService(env.DB).run();
			});
			return;
		}

		log.warn("job", "unhandled_cron", { cron: controller.cron });
	},
};

