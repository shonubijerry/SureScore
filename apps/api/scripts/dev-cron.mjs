// Local development cron runner for Cloudflare Workers.
// Wrangler does not trigger cron handlers automatically in local development.
// This script pings wrangler's /__scheduled test endpoint on intervals.

const API_BASE = process.env.API_URL || "http://localhost:8787";
const LIVE_REFRESH_INTERVAL_MS = Number(process.env.DEV_CRON_INTERVAL_MS) || 3600_000; // 1 hour in dev
const FIXTURE_PREFETCH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

const CRONS = {
	fixturePrefetch: "0 */4 * * *",
	liveRefresh: "*/10 * * * *",
	reconciliation: "0 2 * * *",
};

async function waitForApi() {
	while (true) {
		try {
			const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
			if (res.ok) {
				console.log(`[dev-cron] Connected to API at ${API_BASE}`);
				return;
			}
		} catch {
			// API not ready yet
		}
		await new Promise((r) => setTimeout(r, 1500));
	}
}

async function triggerCron(name, cronExpression) {
	try {
		const url = `${API_BASE}/__scheduled?cron=${encodeURIComponent(cronExpression)}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
		if (res.ok) {
			console.log(`[dev-cron] Triggered ${name} (${cronExpression}) -> ${res.status}`);
		} else {
			console.warn(`[dev-cron] ${name} (${cronExpression}) returned status ${res.status}`);
		}
	} catch (err) {
		console.error(`[dev-cron] Failed to trigger ${name}:`, err.message);
	}
}

async function main() {
	console.log("[dev-cron] Waiting for API server to become ready...");
	await waitForApi();

	// Run initial fixture prefetch so dev environment has fresh match events
	console.log("[dev-cron] Triggering initial fixture prefetch...");
	await triggerCron("fixture-prefetch", CRONS.fixturePrefetch);

	// Then trigger an initial live score refresh
	console.log("[dev-cron] Triggering initial live score refresh...");
	await triggerCron("live-refresh", CRONS.liveRefresh);

	// Periodic live score refresh
	console.log(`[dev-cron] Scheduled live-refresh every ${Math.round(LIVE_REFRESH_INTERVAL_MS / 1000)}s`);
	setInterval(() => {
		triggerCron("live-refresh", CRONS.liveRefresh);
	}, LIVE_REFRESH_INTERVAL_MS);

	// Periodic fixture prefetch
	setInterval(() => {
		triggerCron("fixture-prefetch", CRONS.fixturePrefetch);
	}, FIXTURE_PREFETCH_INTERVAL_MS);
}

main().catch((err) => {
	console.error("[dev-cron] Fatal error:", err);
	process.exit(1);
});
