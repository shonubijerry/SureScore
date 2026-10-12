import { describe, expect, it, vi } from "vitest";
import { PaystackProvider } from "../../src/providers/payment/paystack-provider.js";
import { assertImplementsPaymentProviderContract, assertPaymentResultShape } from "./payment-provider.contract.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }) as Response & { ok: boolean };
}

describe("PaystackProvider", () => {
  it("satisfies the internal PaymentProvider contract", () => {
    const provider = new PaystackProvider({ secretKey: "sk_test", fetchImpl: vi.fn() });
    assertImplementsPaymentProviderContract(provider);
  });

  it("fund() returns a normalized PaymentResult without leaking Paystack response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        message: "ok",
        data: { reference: "ref_123", status: "success", amount: 50000, currency: "NGN" },
      }),
    );
    const provider = new PaystackProvider({ secretKey: "sk_test", fetchImpl });

    const result = await provider.fund({
      potId: "pot_1",
      userId: "user_1",
      countryCode: "NG",
      currency: "NGN",
      amountMinorUnits: 50000,
      idempotencyKey: "idem_1",
    });

    assertPaymentResultShape(result);
    expect(result).toStrictEqual({
      provider: "paystack",
      reference: "ref_123",
      status: "successful",
      amountMinorUnits: 50000,
      currency: "NGN",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/initialize",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("verify() maps a pending Paystack status to the internal pending status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        message: "ok",
        data: { reference: "ref_456", status: "abandoned", amount: 1000, currency: "NGN" },
      }),
    );
    const provider = new PaystackProvider({ secretKey: "sk_test", fetchImpl });

    const result = await provider.verify({ reference: "ref_456" });

    expect(result.status).toBe("pending");
  });

  it("throws when Paystack reports a failed request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: false, message: "Insufficient balance" }, false, 400));
    const provider = new PaystackProvider({ secretKey: "sk_test", fetchImpl });

    await expect(
      provider.payout({
        potId: "pot_1",
        userId: "user_1",
        countryCode: "NG",
        currency: "NGN",
        amountMinorUnits: 1000,
        payoutAccountId: "acct_1",
        recipientCode: "RCP_1",
        idempotencyKey: "idem_2",
      }),
    ).rejects.toThrow("Insufficient balance");
  });
});
