import { describe, expect, it } from "vitest";
import {
	canPotterCancel,
	canTransition,
	isMatchBookable,
	isPredictionLocked,
	nextAutomaticTransition,
	type PotMatchSnapshot,
} from "@surescore/shared";

const kickoff = new Date("2026-10-12T15:00:00Z");
const at = (minutesFromKickoff: number) => new Date(kickoff.getTime() + minutesFromKickoff * 60_000);
const match = (over: Partial<PotMatchSnapshot> = {}): PotMatchSnapshot => ({
	kickoffTimeUtc: kickoff,
	status: "scheduled",
	isFinalResultOfficial: false,
	...over,
});

describe("pot cutoffs", () => {
	it("locks predictions exactly 15 minutes before kickoff", () => {
		expect(isPredictionLocked(kickoff, at(-16))).toBe(false);
		expect(isPredictionLocked(kickoff, at(-15))).toBe(true);
	});

	it("allows potter cancellation only until 20 minutes before kickoff", () => {
		expect(canPotterCancel(kickoff, at(-21))).toBe(true);
		expect(canPotterCancel(kickoff, at(-20))).toBe(false);
	});

	it("only books scheduled matches that are not yet locked", () => {
		expect(isMatchBookable("scheduled", kickoff, at(-30))).toBe(true);
		expect(isMatchBookable("scheduled", kickoff, at(-10))).toBe(false);
		expect(isMatchBookable("postponed", kickoff, at(-30))).toBe(false);
	});
});

describe("pot transitions", () => {
	it("allows the happy path and rejects skips", () => {
		expect(canTransition("Draft", "Funded")).toBe(true);
		expect(canTransition("Draft", "Open")).toBe(false);
		expect(canTransition("Settling", "Paid")).toBe(true);
		expect(canTransition("Refunded", "Open")).toBe(false);
	});
});

describe("nextAutomaticTransition", () => {
	it("locks an open pot at the lock time", () => {
		expect(nextAutomaticTransition("Open", match(), at(-20))).toBeNull();
		expect(nextAutomaticTransition("Open", match(), at(-15))?.to).toBe("Locked");
	});

	it("goes live at kickoff or when the match is in play", () => {
		expect(nextAutomaticTransition("Locked", match(), at(-5))).toBeNull();
		expect(nextAutomaticTransition("Locked", match(), at(0))?.to).toBe("Live");
		expect(nextAutomaticTransition("Locked", match({ status: "first half" }), at(-5))?.to).toBe("Live");
	});

	it("moves to settling only on an official final result", () => {
		expect(nextAutomaticTransition("Live", match({ status: "full time" }), at(100))).toBeNull();
		expect(nextAutomaticTransition("Live", match({ isFinalResultOfficial: true }), at(100))?.to).toBe("Settling");
	});

	it("cancels with the match status as reason when postponed or abandoned", () => {
		for (const status of ["Draft", "Funded", "Open", "Locked", "Live"] as const) {
			expect(nextAutomaticTransition(status, match({ status: "postponed" }), at(-60))).toEqual({
				to: "Cancelled",
				reason: "postponed",
			});
		}
		expect(nextAutomaticTransition("Settling", match({ status: "abandoned" }), at(100))).toBeNull();
	});

	it("expires unfunded drafts once locked and opens funded pots", () => {
		expect(nextAutomaticTransition("Draft", match(), at(-10))?.to).toBe("Cancelled");
		expect(nextAutomaticTransition("Draft", match(), at(-60))).toBeNull();
		expect(nextAutomaticTransition("Funded", match(), at(-60))?.to).toBe("Open");
	});
});
