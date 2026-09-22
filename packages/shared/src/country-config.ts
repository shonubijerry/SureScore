// Configuration-driven country, currency, and provider mapping.
// Nigeria is the only launched market today; adding a country here (plus
// provider adapter support) is the only step required to expand elsewhere.

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  paymentProviderId: string;
  sportsProviderId: string;
  isLaunched: boolean;
}

export interface PaymentProviderConfig {
  id: string;
  name: string;
  countries: string[];
}

export interface SportsProviderConfig {
  id: string;
  name: string;
  leagues: string[];
}

export const countryConfigs: CountryConfig[] = [
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    paymentProviderId: "paystack",
    sportsProviderId: "espn",
    isLaunched: true,
  },
];

export const paymentProviderConfigs: PaymentProviderConfig[] = [
  {
    id: "paystack",
    name: "Paystack",
    countries: ["NG"],
  },
];

export const sportsProviderConfigs: SportsProviderConfig[] = [
  {
    id: "espn",
    name: "ESPN Soccer Scoreboard",
    leagues: ["eng.1", "esp.1", "uefa.champions", "fifa.world"],
  },
];

export function getCountryConfig(countryCode: string): CountryConfig | undefined {
  return countryConfigs.find((country) => country.code === countryCode.toUpperCase());
}

export function isCountrySupported(countryCode: string): boolean {
  return getCountryConfig(countryCode)?.isLaunched === true;
}

export function listSupportedCountries(): CountryConfig[] {
  return countryConfigs.filter((country) => country.isLaunched);
}

export function getPaymentProviderConfig(providerId: string): PaymentProviderConfig | undefined {
  return paymentProviderConfigs.find((provider) => provider.id === providerId);
}

export function getSportsProviderConfig(providerId: string): SportsProviderConfig | undefined {
  return sportsProviderConfigs.find((provider) => provider.id === providerId);
}

export function resolvePaymentProviderForCountry(countryCode: string): PaymentProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = getPaymentProviderConfig(country.paymentProviderId);
  if (!provider) {
    throw new Error(`No payment provider config for "${country.paymentProviderId}"`);
  }
  return provider;
}

export function resolveSportsProviderForCountry(countryCode: string): SportsProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = getSportsProviderConfig(country.sportsProviderId);
  if (!provider) {
    throw new Error(`No sports provider config for "${country.sportsProviderId}"`);
  }
  return provider;
}
