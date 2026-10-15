import { describe, it, expect } from "vitest";
import {
	participantKey,
	reconcile,
	summarizeLedger,
	type ReconLedgerGroup,
	type ReconPot,
} from "@surescore/shared";

const now = new Date("2026-01-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const pot = (over: Partial<ReconPot> = {}): ReconPot => ({
	id: "p1", status: "Paid", currency: "NGN", prizeAmountMinorUnits: 10_000, potterId: "potter",
	updatedAt: hoursAgo(5), cancelledBeforeFunding: false, predictionCount: 2, ...over,
});
const group = (over: Partial<ReconLedgerGroup> = {}): ReconLedgerGroup => ({
	idempotencyKey: "k", potId: "p1", userId: "u1", type: "payout", status: "successful", currency: "NGN",
	amountMinorUnits: 4_500, rows: 1, lastAt: hoursAgo(2), ...over,
});
const fund = group({ idempotencyKey: "fund:p1", userId: "potter", type: "fund", amountMinorUnits: 10_000 });
const run = (pots: ReconPot[], groups: ReconLedgerGroup[], participants: string[] = ["p1:u1", "p1:u2"]) =>
	reconcile({ pots, groups, participants: new Set(participants), sharedAccounts: new Map(), now }).map((f) => f.code);

describe("reconcile", () => {
	it("is clean for a correctly settled pot (90% pool, fee retained)", () => {
		const groups = [
			fund,
			group({ idempotencyKey: "payout:p1:u1", amountMinorUnits: 4_500 }),
			group({ idempotencyKey: "payout:p1:u2", userId: "u2", amountMinorUnits: 4_500 }),
		];
		expect(run([pot()], groups)).toEqual([]);
	});

	it("flags a funded-state pot without confirmed funding and a wrong funded amount", () => {
		expect(run([pot({ status: "Open" })], [])).toContain("FUND_MISSING");
		expect(run([pot()], [{ ...fund, amountMinorUnits: 5_000 }])).toContain("FUND_AMOUNT_MISMATCH");
	});

	it("treats a pending-then-successful fund as one confirmed fund", () => {
		const groups = [{ ...fund, status: "pending" as const }, fund];
		expect(run([pot({ status: "Open" })], groups)).toEqual([]);
	});

	it("flags payouts above the winner pool, to non-participants, and before settlement", () => {
		const over = group({ idempotencyKey: "payout:p1:x", userId: "x", amountMinorUnits: 9_500 });
		const codes = run([pot({ status: "Live" })], [fund, over]);
		expect(codes).toEqual(expect.arrayContaining(["PAYOUT_EXCEEDS_POOL", "PAYOUT_NON_PARTICIPANT", "PAYOUT_BEFORE_SETTLEMENT"]));
	});

	it("flags payout plus refund on the same pot", () => {
		const groups = [fund, group({ idempotencyKey: "payout:p1:u1" }), group({ idempotencyKey: "refund:p1", type: "refund", userId: "potter", amountMinorUnits: 10_000 })];
		expect(run([pot()], groups)).toContain("PAYOUT_AND_REFUND");
	});

	it("flags duplicate successful rows and currency mismatches", () => {
		const dup = group({ idempotencyKey: "payout:p1:u1", rows: 2, currency: "USD" });
		expect(run([pot()], [fund, dup])).toEqual(expect.arrayContaining(["DUPLICATE_SUCCESS", "CURRENCY_MISMATCH"]));
	});

	it("flags missing payouts and refunds only after the grace period", () => {
		expect(run([pot()], [fund])).toContain("PAYOUT_MISSING");
		expect(run([pot({ updatedAt: hoursAgo(0.2) })], [fund])).not.toContain("PAYOUT_MISSING");
		const cancelled = pot({ status: "Cancelled", predictionCount: 0 });
		expect(run([cancelled], [fund])).toContain("REFUND_MISSING");
		expect(run([{ ...cancelled, cancelledBeforeFunding: true }], [])).toEqual([]);
	});

	it("flags Refunded pots whose refund never succeeded and wrong refund amounts", () => {
		const refund = group({ idempotencyKey: "refund:p1", type: "refund", userId: "potter", status: "pending", amountMinorUnits: 9_000 });
		const codes = run([pot({ status: "Refunded" })], [fund, refund]);
		expect(codes).toEqual(expect.arrayContaining(["REFUNDED_WITHOUT_REFUND", "REFUND_AMOUNT_MISMATCH"]));
	});

	it("expects a no-winner refund to keep the platform fee", () => {
		const noWinner = pot({ status: "Refunded", predictionCount: 0, refundReason: "no-winner" });
		const refund = (amountMinorUnits: number) => group({ idempotencyKey: "refund:p1", type: "refund", userId: "potter", amountMinorUnits });
		expect(run([noWinner], [fund, refund(9_000)])).toEqual([]);
		expect(run([noWinner], [fund, refund(10_000)])).toContain("REFUND_AMOUNT_MISMATCH");
		expect(run([pot({ status: "Refunded", refundReason: "postponed" })], [fund, refund(9_000)])).toContain("REFUND_AMOUNT_MISMATCH");
		expect(summarizeLedger([noWinner], [fund, refund(9_000)]).NGN).toMatchObject({ refundedMinorUnits: 9_000, platformFeeMinorUnits: 1_000 });
	});

	it("flags stale pending and long-failing transfers, and potters paying themselves", () => {
		const groups = [
			fund,
			group({ idempotencyKey: "payout:p1:u1", status: "pending", lastAt: hoursAgo(30) }),
			group({ idempotencyKey: "payout:p1:potter", userId: "potter", status: "failed", lastAt: hoursAgo(80) }),
			group({ idempotencyKey: "payout:p1:u2", userId: "u2", amountMinorUnits: 100 }),
		];
		const codes = run([pot()], groups, ["p1:u1", "p1:u2", "p1:potter"]);
		expect(codes).toEqual(expect.arrayContaining(["STALE_PENDING", "UNRESOLVED_FAILURE"]));
		const self = group({ idempotencyKey: "payout:p1:potter", userId: "potter", amountMinorUnits: 100 });
		expect(run([pot()], [fund, self], ["p1:potter"])).toContain("POTTER_WON_OWN_POT");
	});

	it("gives stable fingerprints and masks shared account numbers", () => {
		const input = { pots: [pot()], groups: [fund], participants: new Set<string>(), now, sharedAccounts: new Map([["044/0123456789", ["a", "b"]]]) };
		const [a, b] = [reconcile(input), reconcile(input)];
		expect(a.map((f) => f.fingerprint)).toEqual(b.map((f) => f.fingerprint));
		const shared = a.find((f) => f.code === "SHARED_PAYOUT_ACCOUNT")!;
		expect(shared.detail).toContain("6789");
		expect(shared.detail).not.toContain("0123456789");
	});
});

describe("summarizeLedger", () => {
	it("totals money per currency and counts fees only for paid pots", () => {
		const groups = [
			fund,
			group({ idempotencyKey: "payout:p1:u1", amountMinorUnits: 4_500 }),
			group({ idempotencyKey: "payout:p1:u2", userId: "u2", status: "pending", amountMinorUnits: 4_500 }),
			group({ idempotencyKey: "payout:p1:u3", userId: "u3", status: "failed", amountMinorUnits: 1 }),
		];
		expect(summarizeLedger([pot()], groups).NGN).toEqual({
			fundedMinorUnits: 10_000, paidOutMinorUnits: 4_500, refundedMinorUnits: 0,
			pendingOutMinorUnits: 4_500, failedOutMinorUnits: 1, platformFeeMinorUnits: 1_000,
		});
		expect(summarizeLedger([pot({ status: "Open" })], [fund]).NGN.platformFeeMinorUnits).toBe(0);
	});
});

it("builds participant keys", () => expect(participantKey("p", "u")).toBe("p:u"));
