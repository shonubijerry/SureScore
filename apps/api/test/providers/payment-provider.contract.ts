// Contract assertions for any `PaymentProvider` adapter (T3.6). Adapter
// specs should run their concrete instance through these assertions instead
// of re-asserting shape by hand, so all adapters are held to the same
// internal contract regardless of the underlying provider.

import { expect } from "vitest";
import type { PaymentProvider, PaymentResult } from "@surescore/shared";

const paymentMethods = ["fund", "refund", "createRecipient", "payout", "retryPayout", "verify"] as const;

export function assertImplementsPaymentProviderContract(provider: PaymentProvider): void {
  expect(typeof provider.id).toBe("string");
  expect(provider.id.length).toBeGreaterThan(0);
  for (const method of paymentMethods) {
    expect(typeof provider[method]).toBe("function");
  }
}

export function assertPaymentResultShape(result: PaymentResult): void {
  expect(typeof result.provider).toBe("string");
  expect(typeof result.reference).toBe("string");
  expect(result.reference.length).toBeGreaterThan(0);
  expect(["pending", "successful", "failed"]).toContain(result.status);
  expect(typeof result.amountMinorUnits).toBe("number");
  expect(typeof result.currency).toBe("string");
}
