import { describe, expect, it } from "vitest";
import { computeFreshness } from "@surescore/shared";

const policy = {
	liveRefreshToleranceMs: 20 * 60 * 1000,
	fixtureRefreshToleranceMs: 8 * 60 * 60 * 1000,
};

describe("computeFreshness", () => {
	it("marks a live match refreshed within tolerance as live", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-09-24T11:55:00Z").toISOString();

		expect(computeFreshness("live", lastRefreshedAt, now, policy)).toBe("live");
	});

	it("marks a live match refreshed outside tolerance as stale", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-09-24T11:30:00Z").toISOString();

		expect(computeFreshness("live", lastRefreshedAt, now, policy)).toBe("stale");
	});

	it("marks a scheduled fixture refreshed within tolerance as cached", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-09-24T08:00:00Z").toISOString();

		expect(computeFreshness("scheduled", lastRefreshedAt, now, policy)).toBe("cached");
	});

	it("marks a scheduled fixture refreshed outside tolerance as stale", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-09-24T02:00:00Z").toISOString();

		expect(computeFreshness("scheduled", lastRefreshedAt, now, policy)).toBe("stale");
	});

	it("treats finished results as permanently cached regardless of age", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-01-01T00:00:00Z").toISOString();

		expect(computeFreshness("finished", lastRefreshedAt, now, policy)).toBe("cached");
	});

	it("treats abandoned matches as permanently cached regardless of age", () => {
		const now = new Date("2026-09-24T12:00:00Z");
		const lastRefreshedAt = new Date("2026-01-01T00:00:00Z").toISOString();

		expect(computeFreshness("abandoned", lastRefreshedAt, now, policy)).toBe("cached");
	});
});
