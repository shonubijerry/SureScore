// Provider registry (T3.4): keyed by country + provider type, so backend
// services resolve an adapter purely from country configuration instead of
// hardcoding a specific provider.

import {
  resolvePaymentProviderForCountry as resolvePaymentProviderConfigForCountry,
  resolveSmsProviderForCountry as resolveSmsProviderConfigForCountry,
  resolveEmailProviderForCountry as resolveEmailProviderConfigForCountry,
  resolveSportsProviderForCountry as resolveSportsProviderConfigForCountry,
} from "../config/country-config.js";
import type { PaymentProvider } from "./payment-provider.js";
import type { SportsProvider } from "./sports-provider.js";
import type { SmsProvider } from "./sms-provider.js";
import type { EmailProvider } from "./email-provider.js";

export class ProviderNotRegisteredError extends Error {
  constructor(type: "payment" | "sports" | "sms" | "email", providerId: string) {
    super(`No ${type} provider registered for id "${providerId}"`);
    this.name = "ProviderNotRegisteredError";
  }
}

export class ProviderRegistry {
  private readonly paymentProviders = new Map<string, PaymentProvider>();
  private readonly sportsProviders = new Map<string, SportsProvider>();
  private readonly smsProviders = new Map<string, SmsProvider>();
  private readonly emailProviders = new Map<string, EmailProvider>();

  registerPaymentProvider(provider: PaymentProvider): void {
    this.paymentProviders.set(provider.id, provider);
  }

  registerSportsProvider(provider: SportsProvider): void {
    this.sportsProviders.set(provider.id, provider);
  }

  registerSmsProvider(provider: SmsProvider): void {
    this.smsProviders.set(provider.id, provider);
  }

  getSmsProvider(providerId: string): SmsProvider {
    const provider = this.smsProviders.get(providerId);
    if (!provider) {
      throw new ProviderNotRegisteredError("sms", providerId);
    }
    return provider;
  }

  /** Resolves the SMS provider configured for a country, e.g. KudiSMS for "NG". */
  resolveSmsProviderForCountry(countryCode: string): SmsProvider {
    return this.getSmsProvider(resolveSmsProviderConfigForCountry(countryCode).id);
  }

  registerEmailProvider(provider: EmailProvider): void {
    this.emailProviders.set(provider.id, provider);
  }

  getEmailProvider(providerId: string): EmailProvider {
    const provider = this.emailProviders.get(providerId);
    if (!provider) {
      throw new ProviderNotRegisteredError("email", providerId);
    }
    return provider;
  }

  /** Resolves the email provider configured for a country, e.g. Cloudflare Email Service for "NG". */
  resolveEmailProviderForCountry(countryCode: string): EmailProvider {
    return this.getEmailProvider(resolveEmailProviderConfigForCountry(countryCode).id);
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
