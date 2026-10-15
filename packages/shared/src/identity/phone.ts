// Phone numbers are stored and compared in E.164 form ("+2348012345678").
// Dial codes and number lengths come from country config, so supporting a new
// country needs no change here.

import { countryConfigs, getCountryConfig, type CountryConfig } from "../config/country-config.js";

const nationalDigits = (country: CountryConfig, input: string): string | null => {
  let digits = input.trim().replace(/[\s().-]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith(`+${country.dialCode}`)) return null;
    digits = digits.slice(country.dialCode.length + 1);
  } else if (digits.startsWith(country.dialCode) && digits.length === country.dialCode.length + country.phoneNumberLength) {
    digits = digits.slice(country.dialCode.length);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1); // national trunk prefix, e.g. 0801... in Nigeria
  }
  return /^[1-9]\d*$/.test(digits) && digits.length === country.phoneNumberLength ? digits : null;
};

/** E.164 for a number typed in local ("0801 234 5678") or international form, or null if it is not valid for the country. */
export function toE164(countryCode: string, input: string): string | null {
  const country = getCountryConfig(countryCode);
  if (!country) return null;
  const digits = nationalDigits(country, input);
  return digits ? `+${country.dialCode}${digits}` : null;
}

/** The configured country an E.164 number belongs to, or null when it is malformed or from an unknown country. */
export function countryOfPhone(e164: string): CountryConfig | null {
  if (!/^\+\d+$/.test(e164)) return null;
  return countryConfigs.find((country) => toE164(country.code, e164) === e164) ?? null;
}
