// Provider registry (T3.4): keyed by country + provider type, so backend
// services resolve an adapter purely from country configuration instead of
// hardcoding a specific provider.

import {
  resolvePaymentProviderForCountry as resolvePaymentProviderConfigForCountry,
  resolveSportsProviderForCountry as resolveSportsProviderConfigForCountry,
} from "../country-config.js";
import type { PaymentProvider } from "./payment-provider.js";
import type { SportsProvider } from "./sports-provider.js";

export class ProviderNotRegisteredError extends Error {
  constructor(type: "payment" | "sports", providerId: string) {
    super(`No ${type} provider registered for id "${providerId}"`);
    this.name = "ProviderNotRegisteredError";
  }
}

export class ProviderRegistry {
  private readonly paymentProviders = new Map<string, PaymentProvider>();
  private readonly sportsProviders = new Map<string, SportsProvider>();

  registerPaymentProvider(provider: PaymentProvider): void {
    this.paymentProviders.set(provider.id, provider);
  }

  registerSportsProvider(provider: SportsProvider): void {
    this.sportsProviders.set(provider.id, provider);
  }

  getPaymentProvider(providerId: string): PaymentProvider {
    const provider = this.paymentProviders.get(providerId);
    if (!provider) {
      throw new ProviderNotRegisteredError("payment", providerId);
    }
    return provider;
  }

  getSportsProvider(providerId: string): SportsProvider {
    const provider = this.sportsProviders.get(providerId);
    if (!provider) {
      throw new ProviderNotRegisteredError("sports", providerId);
    }
    return provider;
  }

  /** Resolves the payment provider configured for a country, e.g. Paystack for "NG". */
  resolvePaymentProviderForCountry(countryCode: string): PaymentProvider {
    const config = resolvePaymentProviderConfigForCountry(countryCode);
    return this.getPaymentProvider(config.id);
  }

  /** Resolves the sports data provider configured for a country, e.g. ESPN for "NG". */
  resolveSportsProviderForCountry(countryCode: string): SportsProvider {
    const config = resolveSportsProviderConfigForCountry(countryCode);
    return this.getSportsProvider(config.id);
  }
}
