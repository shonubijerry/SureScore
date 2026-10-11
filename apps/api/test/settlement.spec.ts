import { describe, it, expect, vi } from "vitest";
import { distributePrizes, regulationOutcome, resolveSignupCountry, splitPrizePool } from "@surescore/shared";
import { latestPerAction, SettlementService } from "../src/lib/settlement-service";

const ranked = (...ranks: number[]) => ranks.map((rank, i) => ({ rank, id: `u${i + 1}` }));
const amounts = (r: ReturnType<typeof ranked>, winners: number, prize = 10_000) =>
	distributePrizes(r, winners, prize).map((p) => [p.entry.id, p.amountMinorUnits]);

describe("prize pool", () => {
	it("keeps 10% as platform fee and 90% as winner pool", () => {
		expect(splitPrizePool(10_000)).toEqual({ winnerPool: 9_000, platformFee: 1_000 });
		expect(splitPrizePool(101)).toEqual({ winnerPool: 90, platformFee: 11 });
	});

	it("splits 50/30/20 of the winner pool for three winners", () => {
		expect(amounts(ranked(1, 2, 3, 4), 3)).toEqual([["u1", 4500], ["u2", 2700], ["u3", 1800]]);
	});

	it("merges slots across a tie boundary and splits equally", () => {
		expect(amounts(ranked(1, 2, 2, 4), 3)).toEqual([["u1", 4500], ["u2", 2250], ["u3", 2250]]);
		expect(amounts(ranked(1, 1, 3), 3)).toEqual([["u1", 3600], ["u2", 3600], ["u3", 1800]]);
		expect(amounts(ranked(1, 1, 1, 1), 3)).toEqual([["u1", 2250], ["u2", 2250], ["u3", 2250], ["u4", 2250]]);
	});

	it("always pays out exactly the winner pool, handing leftovers to earliest tied entries", () => {
		const payouts = distributePrizes(ranked(1, 1, 1), 3, 1_002);
		expect(payouts.reduce((s, p) => s + p.amountMinorUnits, 0)).toBe(splitPrizePool(1_002).winnerPool);
		expect(payouts.map((p) => p.amountMinorUnits)).toEqual([301, 300, 300]);
	});

	it("uses the split for the actual player count when players < winner slots", () => {
		expect(amounts(ranked(1), 3)).toEqual([["u1", 9000]]);
		expect(amounts(ranked(1, 2), 3)).toEqual([["u1", 5400], ["u2", 3600]]);
	});

	it("pays nothing without players", () => {
		expect(distributePrizes([], 3, 10_000)).toEqual([]);
	});
});

describe("regulationOutcome", () => {
	const match = { status: "full time", isFinalResultOfficial: true, homeScore: 2, awayScore: 1 };
	it("settles only on an official full-time result", () => {
		expect(regulationOutcome(match)).toMatchObject({ home: 2, away: 1 });
		expect(regulationOutcome({ ...match, status: "extra time" })).toBeNull();
		expect(regulationOutcome({ ...match, status: "second half" })).toBeNull();
		expect(regulationOutcome({ ...match, isFinalResultOfficial: false })).toBeNull();
		expect(regulationOutcome({ ...match, homeScore: null })).toBeNull();
	});
});

describe("signup country", () => {
	it("uses a detected launched country and otherwise defaults to Nigeria", () => {
		expect(resolveSignupCountry("ng").code).toBe("NG");
		expect(resolveSignupCountry("US").code).toBe("NG");
		expect(resolveSignupCountry(undefined).code).toBe("NG");
	});
});

describe("latestPerAction", () => {
	it("keeps the highest attempt per idempotency key", () => {
		const rows = [
			{ entryKey: "k:2", idempotencyKey: "k", status: "successful" },
			{ entryKey: "k:10", idempotencyKey: "k", status: "failed" },
			{ entryKey: "k:3", idempotencyKey: "k", status: "pending" },
			{ entryKey: "j:1", idempotencyKey: "j", status: "pending" },
		];
		expect(latestPerAction(rows).map((r) => r.entryKey).sort()).toEqual(["j:1", "k:10"]);
	});
});

describe("SettlementService.settle", () => {
	const pot = (overrides: object = {}, predictions: object[] = []) => ({
		id: "p1", status: "Settling", countryCode: "NG", currency: "NGN", provider: "paystack",
		prizeAmountMinorUnits: 10_000, winnerCount: 2,
		event: { status: "full time", isFinalResultOfficial: true, homeScore: 1, awayScore: 0 },
		predictions, ...overrides,
	});
	const player = (id: string, home: number, away: number, accounts = [{ id: `a-${id}`, countryCode: "NG", isDefault: true }]) => ({
		homeGoals: home, awayGoals: away, firstGoalMinute: null, user: { id, payoutAccounts: accounts },
	});

	const build = (found: object | null) => {
		const send = vi.fn().mockResolvedValue(undefined);
		const pots = { transition: vi.fn().mockResolvedValue(true), cancel: vi.fn().mockResolvedValue(true) };
		const ledger = { append: vi.fn().mockResolvedValue(undefined), isInFlightOrDone: vi.fn() };
		const db = { pot: { findUnique: vi.fn().mockResolvedValue(found) } };
		const service = new SettlementService({ TRANSFER_QUEUE: { sendBatch: send }, DB: {} } as never, pots as never, ledger as never);
		(service as unknown as { db: unknown }).db = db;
		return { service, send, pots, ledger };
	};

	it("ranks persisted predictions, queues payouts and marks the pot Paid", async () => {
		const { service, send, pots } = build(pot({}, [player("exact", 1, 0), player("wrong", 0, 3)]));
		expect(await service.settle("p1")).toBe(true);
		expect(send).toHaveBeenCalledWith([
			{ body: { type: "payout", request: expect.objectContaining({ userId: "exact", amountMinorUnits: 5400, idempotencyKey: "payout:p1:exact", payoutAccountId: "a-exact" }) } },
			{ body: { type: "payout", request: expect.objectContaining({ userId: "wrong", amountMinorUnits: 3600 }) } },
		]);
		expect(pots.transition).toHaveBeenCalledWith(expect.anything(), "Paid", expect.anything(), expect.any(String));
	});

	it("waits for the regulation result and ignores non-settling pots", async () => {
		const early = build(pot({ event: { status: "extra time", isFinalResultOfficial: false, homeScore: 1, awayScore: 1 } }, [player("a", 1, 1)]));
		expect(await early.service.settle("p1")).toBe(false);
		expect(early.send).not.toHaveBeenCalled();
		const paid = build(pot({ status: "Paid" }, [player("a", 1, 0)]));
		expect(await paid.service.settle("p1")).toBe(false);
		expect(paid.send).not.toHaveBeenCalled();
	});

	it("refunds the pot when nobody predicted", async () => {
		const { service, pots, send } = build(pot());
		await service.settle("p1");
		expect(pots.cancel).toHaveBeenCalledOnce();
		expect(send).not.toHaveBeenCalled();
	});

	it("records a failed payout when a winner has no payout account", async () => {
		const { service, ledger, send } = build(pot({ winnerCount: 1 }, [player("a", 1, 0, [])]));
		await service.settle("p1");
		expect(ledger.append).toHaveBeenCalledWith(expect.objectContaining({ type: "payout", status: "failed", userId: "a", attempt: 0 }));
		expect(send).not.toHaveBeenCalled();
	});
});
