import { describe, expect, it, vi } from "vitest";
import { ProviderNotRegisteredError, ProviderRegistry } from "@surescore/shared";
import { PaystackProvider } from "../../src/providers/payment/paystack-provider.js";
import { EspnSportsProvider } from "../../src/providers/sports/espn-provider.js";

describe("ProviderRegistry", () => {
  it("resolves the payment and sports providers configured for a launched country", () => {
    const registry = new ProviderRegistry();
    registry.registerPaymentProvider(new PaystackProvider({ secretKey: "sk_test", fetchImpl: vi.fn() }));
    registry.registerSportsProvider(new EspnSportsProvider({ fetchImpl: vi.fn() }));

    expect(registry.resolvePaymentProviderForCountry("NG").id).toBe("paystack");
    expect(registry.resolveSportsProviderForCountry("NG").id).toBe("espn");
  });

  it("throws ProviderNotRegisteredError when the configured provider was never registered", () => {
    const registry = new ProviderRegistry();

    expect(() => registry.resolvePaymentProviderForCountry("NG")).toThrow(ProviderNotRegisteredError);
    expect(() => registry.resolveSportsProviderForCountry("NG")).toThrow(ProviderNotRegisteredError);
  });

  it("throws for a country with no configuration at all", () => {
    const registry = new ProviderRegistry();

    expect(() => registry.resolvePaymentProviderForCountry("ZZ")).toThrow();
  });
});
