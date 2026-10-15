// Configuration-driven country, currency, and provider mapping.
// Nigeria is the only launched market today; adding a country here (plus
// provider adapter support) is the only step required to expand elsewhere.

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  paymentProviderId: string;
  sportsProviderId: string;
  smsProviderId: string;
  /** Transactional email (sign-in codes, password resets). */
  emailProviderId: string;
  /** International dialling code without "+", e.g. "234". */
  dialCode: string;
  /** Digits in a national mobile number after the dial code (no trunk "0"). */
  phoneNumberLength: number;
  isLaunched: boolean;
}

export interface PaymentProviderConfig {
  id: string;
  name: string;
  countries: string[];
}

export interface SmsProviderConfig {
  id: string;
  name: string;
  countries: string[];
}

export interface LeagueConfig {
  /** Provider league code, e.g. "eng.1" for ESPN. */
  code: string;
  name: string;
  /** Logo for light backgrounds. */
  logoUrl: string;
  /** Logo for dark backgrounds. */
  darkLogoUrl: string;
}

/** Same shape as SMS: an id, a name and the countries it serves. */
export type EmailProviderConfig = SmsProviderConfig;

export interface SportsProviderConfig {
  id: string;
  name: string;
  /** Supported leagues, in display order. Omitted = every league the provider offers. */
  leagues?: LeagueConfig[];
  /** Team logo URL template; `{teamId}` is replaced with the provider team id. */
  teamLogoUrl?: string;
}

export const countryConfigs: CountryConfig[] = [
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    paymentProviderId: "paystack",
    sportsProviderId: "espn",
    smsProviderId: "kudisms",
    emailProviderId: "cloudflare-email",
    dialCode: "234",
    phoneNumberLength: 10,
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

export const smsProviderConfigs: SmsProviderConfig[] = [
  {
    id: "kudisms",
    name: "KudiSMS",
    countries: ["NG"],
  },
];

const league = (code: string, name: string, logoUrl: string, darkLogoUrl: string): LeagueConfig => ({ code, name, logoUrl, darkLogoUrl });

export const emailProviderConfigs: EmailProviderConfig[] = [
  {
    id: "cloudflare-email",
    name: "Cloudflare Email Service",
    countries: ["NG"],
  },
];

export const sportsProviderConfigs: SportsProviderConfig[] = [
  {
    id: "espn",
    name: "ESPN Soccer Scoreboard",
    teamLogoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/{teamId}.png",
    // Names and logos taken from ESPN's scoreboard response (`leagues[0].logos`).
    leagues: [
      league("eng.1", "Premier League", "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/23.png"),
      league("esp.1", "LALIGA", "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/15.png"),
      league("ger.1", "Bundesliga", "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/10.png"),
      league("ita.1", "Serie A", "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/12.png"),
      league("fra.1", "Ligue 1", "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/9.png"),
      league("uefa.champions", "UEFA Champions League", "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2.png"),
      league("uefa.europa", "UEFA Europa League", "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2310.png"),
      league("uefa.europa.conf", "UEFA Conference League", "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png", "https://a.espncdn.com/i/leaguelogos/soccer/500-dark/20296.png"),
    ],
  },
];

export function getCountryConfig(
  countryCode: string,
): CountryConfig | undefined {
  return countryConfigs.find(
    (country) => country.code === countryCode.toUpperCase(),
  );
}

export const DEFAULT_COUNTRY_CODE = "NG";

/** Launched country for a request-detected code, falling back to the default market. */
export function resolveSignupCountry(detectedCode?: string | null): CountryConfig {
  const detected = detectedCode ? getCountryConfig(detectedCode) : undefined;
  return detected?.isLaunched ? detected : getCountryConfig(DEFAULT_COUNTRY_CODE)!;
}

export function isCountrySupported(countryCode: string): boolean {
  return getCountryConfig(countryCode)?.isLaunched === true;
}

export function listSupportedCountries(): CountryConfig[] {
  return countryConfigs.filter((country) => country.isLaunched);
}

export function getPaymentProviderConfig(
  providerId: string,
): PaymentProviderConfig | undefined {
  return paymentProviderConfigs.find((provider) => provider.id === providerId);
}

export function getSportsProviderConfig(
  providerId: string,
): SportsProviderConfig | undefined {
  return sportsProviderConfigs.find((provider) => provider.id === providerId);
}

export function resolvePaymentProviderForCountry(
  countryCode: string,
): PaymentProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = getPaymentProviderConfig(country.paymentProviderId);
  if (!provider) {
    throw new Error(
      `No payment provider config for "${country.paymentProviderId}"`,
    );
  }
  return provider;
}

export function resolveSmsProviderForCountry(countryCode: string): SmsProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = smsProviderConfigs.find((p) => p.id === country.smsProviderId);
  if (!provider) {
    throw new Error(`No SMS provider config for "${country.smsProviderId}"`);
  }
  return provider;
}

export function resolveEmailProviderForCountry(countryCode: string): EmailProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = emailProviderConfigs.find((p) => p.id === country.emailProviderId);
  if (!provider) {
    throw new Error(`No email provider config for "${country.emailProviderId}"`);
  }
  return provider;
}

export function resolveSportsProviderForCountry(
  countryCode: string,
): SportsProviderConfig {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new Error(`No country config for "${countryCode}"`);
  }
  const provider = getSportsProviderConfig(country.sportsProviderId);
  if (!provider) {
    throw new Error(
      `No sports provider config for "${country.sportsProviderId}"`,
    );
  }
  return provider;
}

/** League codes a sports provider is configured for (empty when unrestricted). */
export function leagueCodes(providerId: string): string[] {
  return getSportsProviderConfig(providerId)?.leagues?.map((l) => l.code) ?? [];
}

/** A configured league of any sports provider, by its code. */
export function getLeagueConfig(code: string): LeagueConfig | undefined {
  for (const provider of sportsProviderConfigs) {
    const found = provider.leagues?.find((l) => l.code === code);
    if (found) return found;
  }
  return undefined;
}

/** Logo URL for a provider team id, or null when the provider has no logo template or the id is unknown. */
export function teamLogoUrl(providerId: string, teamId?: string | null): string | null {
  const template = getSportsProviderConfig(providerId)?.teamLogoUrl;
  return template && teamId ? template.replace("{teamId}", encodeURIComponent(teamId)) : null;
}
