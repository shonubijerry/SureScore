import { describe, expect, it } from "vitest";
import { rankPredictions, scorePrediction } from "@surescore/shared";

const score = (pick: [number, number], actual: [number, number]) =>
	scorePrediction({ home: pick[0], away: pick[1] }, { home: actual[0], away: actual[1] });

describe("scorePrediction", () => {
	it("gives the maximum for an exact scoreline", () => {
		expect(score([2, 1], [2, 1])).toEqual({
			outcome: 3, exactScoreline: 5, goalDifference: 2, homeGoals: 1, awayGoals: 1, total: 12,
		});
	});

	it("awards outcome, goal difference and one team count for a same-difference miss", () => {
		const b = score([3, 2], [2, 1]);
		expect(b).toMatchObject({ outcome: 3, exactScoreline: 0, goalDifference: 2, homeGoals: 0, awayGoals: 0, total: 5 });
	});

	it("scores a drawn outcome with the wrong goals", () => {
		expect(score([1, 1], [0, 0])).toMatchObject({ outcome: 3, goalDifference: 2, total: 5 });
	});

	it("awards team goal counts even when the outcome is wrong", () => {
		expect(score([1, 2], [1, 0])).toMatchObject({ outcome: 0, goalDifference: 0, homeGoals: 1, awayGoals: 0, total: 1 });
	});

	it("scores zero when nothing matches", () => {
		expect(score([0, 3], [2, 0]).total).toBe(0);
	});
});

describe("rankPredictions", () => {
	const actual = { home: 2, away: 1 };
	const entry = (item: string, home: number, away: number, firstGoalMinute?: number) => ({
		item,
		pick: { home, away, firstGoalMinute },
	});

	it("ranks by points and shares a rank on ties (1, 1, 3)", () => {
		const ranked = rankPredictions([entry("c", 0, 3), entry("a", 2, 1), entry("b", 2, 1)], actual);
		expect(ranked.map((r) => [r.item, r.rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
	});

	it("returns an empty leaderboard for no predictions", () => {
		expect(rankPredictions([], actual)).toEqual([]);
	});

	it("breaks ties by first-goal proximity when enabled", () => {
		const ranked = rankPredictions(
			[entry("far", 2, 1, 80), entry("none", 2, 1), entry("near", 2, 1, 12)],
			{ ...actual, firstGoalMinute: 10 },
			{ tieBreaks: ["firstGoalProximity"] },
		);
		expect(ranked.map((r) => [r.item, r.rank])).toEqual([["near", 1], ["far", 2], ["none", 3]]);
	});

	it("keeps a shared rank when the tie-break is also level", () => {
		const ranked = rankPredictions(
			[entry("a", 2, 1, 15), entry("b", 2, 1, 5)],
			{ ...actual, firstGoalMinute: 10 },
			{ tieBreaks: ["firstGoalProximity"] },
		);
		expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
	});

	it("never lets a tie-break outrank more points", () => {
		const ranked = rankPredictions(
			[entry("exactNoMinute", 2, 1), entry("closeButWrong", 1, 0, 10)],
			{ ...actual, firstGoalMinute: 10 },
			{ tieBreaks: ["firstGoalProximity"] },
		);
		expect(ranked[0].item).toBe("exactNoMinute");
	});

	it("applies the underdog bonus only to picks that backed a winning underdog", () => {
		const bonus = (home: number, away: number, outcome: Parameters<typeof rankPredictions>[1]) =>
			rankPredictions([entry("x", home, away)], outcome, { tieBreaks: ["underdogBonus"] })[0].tieBreaks[0];
		const upset = { home: 2, away: 0, underdog: "home" as const };
		expect(bonus(1, 0, upset)).toBe(1);
		expect(bonus(0, 1, upset)).toBe(0);
		expect(bonus(1, 1, upset)).toBe(0);
		expect(bonus(1, 0, { home: 0, away: 1, underdog: "home" })).toBe(0);
		expect(bonus(1, 0, { home: 2, away: 0 })).toBe(0);
	});
});

describe("default tie-breaks", () => {
	it("orders underdog backers first, then nearest first-goal minute", async () => {
		const { DEFAULT_TIE_BREAKS } = await import("@surescore/shared");
		const actual = { home: 1, away: 0, firstGoalMinute: 30, underdog: "home" as const };
		const e = (item: string, home: number, away: number, firstGoalMinute: number) => ({
			item,
			pick: { home, away, firstGoalMinute },
		});
		// "near" and "far" tie on points; the nearer first-goal minute wins. "level" has fewer points.
		const ranked = rankPredictions(
			[e("far", 2, 1, 80), e("near", 2, 1, 31), e("level", 1, 1, 30)],
			actual,
			{ tieBreaks: DEFAULT_TIE_BREAKS },
		);
		expect(ranked.map((r) => r.item)).toEqual(["near", "far", "level"]);
		expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
	});
});
