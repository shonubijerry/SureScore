import { describe, it, expect, vi } from "vitest";
import { handleTransferBatch, retryDelaySeconds, type TransferJob } from "../../src/modules/payments/transfer-queue";

const payoutJob: TransferJob = {
	type: "payout",
	request: {
		potId: "p1", userId: "u1", countryCode: "NG", currency: "NGN",
		amountMinorUnits: 5000, payoutAccountId: "acct", idempotencyKey: "payout:p1:u1",
	},
};

const makeMessage = (body: TransferJob, attempts = 1) => ({ body, attempts, ack: vi.fn(), retry: vi.fn() });
const makeLedger = (inFlight = false) => ({
	append: vi.fn().mockResolvedValue(undefined),
	isInFlightOrDone: vi.fn().mockResolvedValue(inFlight),
});
const run = (messages: ReturnType<typeof makeMessage>[], provider: object, ledger = makeLedger(), onRefunded?: (id: string) => Promise<unknown>) =>
	handleTransferBatch({ messages } as never, {} as Env, { resolveProvider: () => provider as never, ledger, onRefunded, resolveRecipient: async () => "RCP_1" });

describe("transfer queue consumer", () => {
	it("acks successful and pending transfers", async () => {
		const m = makeMessage(payoutJob);
		await run([m], { payout: vi.fn().mockResolvedValue({ status: "pending" }) });
		expect(m.ack).toHaveBeenCalled();
		expect(m.retry).not.toHaveBeenCalled();
	});

	const { payoutAccountId: _, ...transfer } = payoutJob.request;
	const legacyRefund = { ...transfer, reason: "cancelled", originalReference: "fund-ref", idempotencyKey: "refund:p1" };

	it("reverses the funding payment for refunds without a refund account", async () => {
		const refund = vi.fn().mockResolvedValue({ status: "successful" });
		const m = makeMessage({ type: "refund", request: { ...legacyRefund, reason: "postponed" } } as never);
		await run([m], { refund });
		expect(refund).toHaveBeenCalledOnce();
		expect(m.ack).toHaveBeenCalled();
	});

	it("transfers refunds to the potter's refund account", async () => {
		const refund = vi.fn();
		const payout = vi.fn().mockResolvedValue({ status: "successful", provider: "paystack", reference: "r" });
		const onRefunded = vi.fn().mockResolvedValue(true);
		const request = { ...legacyRefund, reason: "no-winner", amountMinorUnits: 9_000, payoutAccountId: "acct-potter" };
		await run([makeMessage({ type: "refund", request } as never)], { refund, payout }, makeLedger(), onRefunded);
		expect(refund).not.toHaveBeenCalled();
		expect(payout).toHaveBeenCalledWith(
			expect.objectContaining({ payoutAccountId: "acct-potter", recipientCode: "RCP_1", amountMinorUnits: 9_000, idempotencyKey: "refund:p1" }),
		);
		expect(onRefunded).toHaveBeenCalledWith("p1");
	});

	it("marks the pot refunded only after a successful refund", async () => {
		const onRefunded = vi.fn().mockResolvedValue(true);
		const body = { type: "refund", request: legacyRefund } as never;
		await run([makeMessage(body)], { refund: vi.fn().mockResolvedValue({ status: "pending" }) }, makeLedger(), onRefunded);
		expect(onRefunded).not.toHaveBeenCalled();
		await run([makeMessage(body)], { refund: vi.fn().mockResolvedValue({ status: "successful" }) }, makeLedger(), onRefunded);
		expect(onRefunded).toHaveBeenCalledWith("p1");
	});

	it("retries with backoff on failed result or thrown error", async () => {
		const failed = makeMessage(payoutJob, 2);
		const thrown = makeMessage(payoutJob, 1);
		await run([failed], { payout: vi.fn().mockResolvedValue({ status: "failed" }) });
		await run([thrown], { payout: vi.fn().mockRejectedValue(new Error("boom")) });
		expect(failed.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
		expect(thrown.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
	});

	it("records each outcome in the ledger", async () => {
		const ledger = makeLedger();
		await run([makeMessage(payoutJob, 3)], { payout: vi.fn().mockResolvedValue({ status: "successful", provider: "paystack", reference: "r1" }) }, ledger);
		expect(ledger.append).toHaveBeenCalledWith(
			expect.objectContaining({ type: "payout", status: "successful", attempt: 3, reference: "r1", idempotencyKey: "payout:p1:u1" }),
		);
	});

	it("records thrown errors as failed ledger entries", async () => {
		const ledger = makeLedger();
		await run([makeMessage(payoutJob)], { id: "paystack", payout: vi.fn().mockRejectedValue(new Error("boom")) }, ledger);
		expect(ledger.append).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
	});

	it("does not resend an action already pending or settled", async () => {
		const payout = vi.fn();
		const m = makeMessage(payoutJob);
		await run([m], { payout }, makeLedger(true));
		expect(payout).not.toHaveBeenCalled();
		expect(m.ack).toHaveBeenCalled();
	});

	it("caps backoff", () => {
		expect(retryDelaySeconds(20)).toBe(3600);
	});
});
