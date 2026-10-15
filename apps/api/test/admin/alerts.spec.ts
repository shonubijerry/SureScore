import { describe, expect, it } from "vitest";
import { evaluateAlerts } from "../../src/modules/admin/alerts";

describe("alerts", () => {
	const health = (over: object = {}) => ({
		sports: [{ provider: "espn", events: 10, stale: 0, lastRefreshedAt: new Date(), failedJobs24h: 0 }],
		payments: [{ provider: "paystack", successful24h: 5, pending24h: 0, failed24h: 0, failureRate: 0, lastFailureAt: null, lastFailureDetail: null }],
		jobs: [],
		recentFailures: [],
		...over,
	});

	it("is quiet when healthy", () => expect(evaluateAlerts(health() as never, 0)).toEqual([]));

	it("raises provider, stale-data, payout and job alerts", () => {
		const kinds = evaluateAlerts(
			health({
				sports: [{ provider: "espn", events: 10, stale: 3, lastRefreshedAt: new Date(), failedJobs24h: 2 }],
				payments: [{ provider: "paystack", successful24h: 1, pending24h: 0, failed24h: 3, failureRate: 0.75, lastFailureAt: null, lastFailureDetail: null }],
				jobs: [{ job: "settlement", kind: "payments", runs24h: 3, failures24h: 1, lastRunAt: new Date() }],
			}) as never,
			2,
		).map((a) => a.kind);
		expect(new Set(kinds)).toEqual(new Set(["provider_failure", "stale_sports_data", "failed_payouts", "failed_job"]));
	});
});
