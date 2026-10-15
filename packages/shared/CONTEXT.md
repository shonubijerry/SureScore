# Shared package context map

## Purpose
- Cross-package policy and config layer.
- Holds country mapping, payout rules, eligibility checks, and provider metadata.
- Keeps product rules independent from provider adapters and app-specific code.

## Folder layout
- src/config/: country-config.ts (countries, currencies, payment/sports/SMS/email provider and league mapping), banks.ts
- src/identity/: phone.ts (E.164), email.ts, name-match.ts (payout account names), roles.ts (roles + permissions)
- src/rules/: pure product rules, no I/O: pot-rules, scoring, settlement, eligibility, reconciliation, cache-freshness
- src/providers/: provider contracts (interfaces only) + provider-registry.ts
- src/index.ts: re-exports everything, grouped by folder; consumers import from "@surescore/shared" only

## Key files
- src/config/country-config.ts: supported countries, currencies, payment provider mapping, sports provider mapping
- src/rules/eligibility.ts: policy helpers, including the first-prediction payout completion rule
- src/providers/payment-provider.ts: internal `PaymentProvider` interface (fund, refund, payout, retryPayout, verify)
- src/providers/sports-provider.ts: internal `SportsProvider` interface + normalized `SportsEvent` schema
- src/providers/provider-registry.ts: `ProviderRegistry` resolving adapters by country via country-config
- src/index.ts: exports for shared config, policy, and provider-abstraction modules

## Core rules
- Nigeria is the current launched market, but country logic is config-driven
- User country must match pot/currency eligibility rules
- No cross-currency payout conversion
- First prediction is blocked until payout details are completed for the user’s country

## Important conventions
- Prefer static config objects over DB-backed config tables unless a domain requirement demands otherwise
- Keep this package free of provider-specific implementation details
- Domain rules here should be explicit and testable
- `providers/` holds only the internal interfaces/registry, never concrete adapters (Paystack, ESPN, etc. live in apps/api/src/providers)

## Commands
- pnpm --filter @surescore/shared build
