// Alerts (T11.2) derived from the same health data admins see: provider
// failures, stale sports data, failed payouts and failed scheduled jobs.
// `evaluateAlerts` is pure; `dispatchAlerts` notifies an optional webhook once
// per alert per hour (KV dedupe) and always logs at error level.

import { createDbClient } from "@surescore/db";
import { AdminOpsService } from "./ops.js";
import { log } from "../../platform/logger.js";

export type AlertKind = "provider_failure" | "stale_sports_data" | "failed_payouts" | "failed_job";
export interface Alert {
	kind: AlertKind;
	severity: "warning" | "critical";
	key: string;
	message: string;
}

type Health = Awaited<ReturnType<AdminOpsService["health"]>>;

const MIN_ATTEMPTS_FOR_RATE = 3;
const FAILURE_RATE_THRESHOLD = 0.5;
// Two missed 4-hourly prefetch cycles.
const SPORTS_STALE_AFTER_MS = 8 * 3_600_000;
const DEDUPE_TTL_SECONDS = 3600;

export function evaluateAlerts(health: Health, failedPayouts: number, now = new Date()): Alert[] {
	const alerts: Alert[] = [];

	for (const p of health.payments) {
		if (p.successful24h + p.failed24h >= MIN_ATTEMPTS_FOR_RATE && p.failureRate >= FAILURE_RATE_THRESHOLD) {
			alerts.push({
				kind: "provider_failure",
				severity: "critical",
				key: `payments:${p.provider}`,
				message: `Payment provider ${p.provider}: ${Math.round(p.failureRate * 100)}% of transfers failed in 24h.`,
			});
		}
	}
	for (const s of health.sports) {
		if (s.failedJobs24h > 0) {
			alerts.push({
				kind: "provider_failure",
				severity: "warning",
				key: `sports:${s.provider}`,
				message: `Sports provider ${s.provider}: ${s.failedJobs24h} failed sync run(s) in 24h.`,
			});
		}
		const old = s.lastRefreshedAt && now.getTime() - s.lastRefreshedAt.getTime() > SPORTS_STALE_AFTER_MS;
		if (s.events > 0 && (s.stale > 0 || old)) {
			alerts.push({
				kind: "stale_sports_data",
				severity: "warning",
				key: `stale:${s.provider}`,
				message: `Sports data from ${s.provider} is stale (${s.stale} of ${s.events} events).`,
			});
		}
	}
	if (failedPayouts > 0) {
		alerts.push({
			kind: "failed_payouts",
			severity: "critical",
			key: "payouts",
			message: `${failedPayouts} payout(s) are in a failed state and need admin retry.`,
		});
	}
	for (const j of health.jobs) {
		if (j.failures24h > 0) {
			alerts.push({
				kind: "failed_job",
				severity: "warning",
				key: `job:${j.job}`,
				message: `Scheduled job ${j.job} failed ${j.failures24h} time(s) in 24h.`,
			});
		}
	}
	return alerts;
}

/** Payouts whose latest attempt failed and that have no pending/successful sibling. */
async function countFailedPayouts(database: D1Database) {
	const db = createDbClient(database);
	const failed = await db.ledgerEntry.findMany({
		where: { type: "payout", status: "failed" },
		distinct: ["idempotencyKey"],
		select: { idempotencyKey: true },
	});
	if (!failed.length) return 0;
	const settled = new Set<string>();
	for (let i = 0; i < failed.length; i += 50) {
		const rows = await db.ledgerEntry.findMany({
			where: { idempotencyKey: { in: failed.slice(i, i + 50).map((f) => f.idempotencyKey) }, status: { in: ["pending", "successful"] } },
			select: { idempotencyKey: true },
		});
		rows.forEach((r) => settled.add(r.idempotencyKey));
	}
	return failed.filter((f) => !settled.has(f.idempotencyKey)).length;
}

export async function currentAlerts(database: D1Database, now = new Date()) {
	const [health, failedPayouts] = await Promise.all([new AdminOpsService(database).health(now), countFailedPayouts(database)]);
	return evaluateAlerts(health, failedPayouts, now);
}

export async function dispatchAlerts(env: Pick<Env, "DB" | "SESSIONS" | "ALERT_WEBHOOK_URL">) {
	const alerts = await currentAlerts(env.DB);
	const fresh: Alert[] = [];
	for (const alert of alerts) {
		const key = `alert:${alert.key}`;
		if (await env.SESSIONS.get(key)) continue;
		await env.SESSIONS.put(key, "1", { expirationTtl: DEDUPE_TTL_SECONDS });
		log.error("alert", alert.kind, { key: alert.key, severity: alert.severity, message: alert.message });
		fresh.push(alert);
	}
	if (fresh.length && env.ALERT_WEBHOOK_URL) {
		const text = fresh.map((a) => `[${a.severity}] ${a.message}`).join("\n");
		await fetch(env.ALERT_WEBHOOK_URL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text, alerts: fresh }),
		}).catch((error) => log.error("alert", "webhook_failed", { error }));
	}
	return fresh;
}
