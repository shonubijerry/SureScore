// Country-driven eligibility policies. Keep provider-specific logic out of
// here; this module only ever reasons about country codes and config.

import { getCountryConfig, isCountrySupported } from "./country-config.js";

export class EligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibilityError";
  }
}

export interface PayoutDetailsRecord {
  countryCode?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  isVerified?: boolean | null;
}

/** Throws if the country is not a launched market. */
export function assertCountrySupported(countryCode: string): void {
  if (!isCountrySupported(countryCode)) {
    throw new EligibilityError(`Country "${countryCode}" is not currently supported.`);
  }
}

/**
 * Users may only participate in pots created for their own signup country.
 * There is no cross-currency payout, so cross-country participation is
 * disallowed at the policy level rather than the payment level.
 */
export function assertSameCountryEligibility(userCountryCode: string, potCountryCode: string): void {
  if (userCountryCode.toUpperCase() !== potCountryCode.toUpperCase()) {
    throw new EligibilityError(
      `User country "${userCountryCode}" is not eligible for pots in "${potCountryCode}".`,
    );
  }
}

/** Throws if the user's country and the requested currency don't match the configured payout currency. */
export function assertCurrencyMatchesCountry(countryCode: string, currency: string): void {
  const country = getCountryConfig(countryCode);
  if (!country) {
    throw new EligibilityError(`Country "${countryCode}" is not configured.`);
  }
  if (country.currency !== currency.toUpperCase()) {
    throw new EligibilityError(
      `Currency "${currency}" does not match the payout currency "${country.currency}" for "${countryCode}".`,
    );
  }
}

/**
 * First predictions are blocked until the user has at least one valid payout
 * record for their signup country. This prevents users from building a betting
 * history before they have completed the payout setup required for settlements.
 */
export function assertHasCompletedPayoutDetails(
  userCountryCode: string,
  payoutAccounts: PayoutDetailsRecord[],
  options: { requireCountryMatch?: boolean; requireVerified?: boolean } = {},
): void {
  const normalizedCountry = userCountryCode.toUpperCase();
  const requireCountryMatch = options.requireCountryMatch ?? true;
  const requireVerified = options.requireVerified ?? false;

  const hasCompletedRecord = payoutAccounts.some((account) => {
    const countryMatches = !requireCountryMatch || (account.countryCode ?? "").toUpperCase() === normalizedCountry;
    const hasName = typeof account.accountName === "string" && account.accountName.trim().length > 0;
    const hasNumber = typeof account.accountNumber === "string" && account.accountNumber.trim().length > 0;
    const isVerified = requireVerified ? account.isVerified === true : true;

    return countryMatches && hasName && hasNumber && isVerified;
  });

  if (!hasCompletedRecord) {
    throw new EligibilityError(
      `User must complete payout details for "${normalizedCountry}" before making their first prediction.`,
    );
  }
}
