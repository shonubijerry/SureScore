# API package context map

## Purpose
- Cloudflare Worker API for SureScore.
- Uses Hono + Chanfana for typed OpenAPI routes.
- Persists relational data in D1 via Prisma.
- Uses KV for session tokens and JWT revocation.

## Core architecture
- Main entry: src/index.ts
- Route registry: src/router.ts
- Resource modules live under src/routes/{resource}/
- Each endpoint is a single-responsibility Chanfana OpenAPIRoute class
- Shared app env contract: src/types.ts
- Auth/session logic: src/lib/auth.ts
- Middleware and common helpers: src/lib/middleware.ts and src/lib/openapi.ts

## Route layout
- auth/: signup, login, logout, me
- config/: countries, payment providers, sports providers
- payout-accounts/: list, create, update, delete
- sports/: matches/upcoming, matches/live, matches/:id (read-only, backed by the sports event cache)
- Keep one endpoint per file and mount nested routers from each index.ts

## Provider adapters
- src/providers/payment/paystack-provider.ts: implements `@surescore/shared`'s `PaymentProvider` for Paystack
- src/providers/sports/espn-provider.ts: implements `@surescore/shared`'s `SportsProvider` for ESPN, normalizing into `SportsEvent`
- src/providers/registry.ts: `createProviderRegistry(env)` builds a `ProviderRegistry` with all adapters registered; backend services should resolve adapters via `registry.resolvePaymentProviderForCountry(countryCode)` / `resolveSportsProviderForCountry(countryCode)` instead of importing Paystack/ESPN classes directly
- Needs `PAYSTACK_SECRET_KEY` env var (same pattern as `AUTH_SECRET`) — set in apps/api/.dev.vars locally, `wrangler secret put PAYSTACK_SECRET_KEY` in prod
- test/providers/*.contract.ts: reusable contract assertions; adapter specs (paystack-provider.spec.ts, espn-provider.spec.ts) run their adapter through these plus provider-registry.spec.ts covers resolution/error behavior

## Sports data ingestion and cache
- src/lib/sports-cache-repository.ts: `SportsEventCacheStore` interface (store-agnostic) + `PrismaSportsEventCacheStore` adapter over the `SportsEventCache` D1 table; cache row id is `"{provider}:{externalId}"`
- src/lib/sports-ingestion.ts: `prefetchFixtures`/`refreshLiveScores` (pure functions over `SportsProvider` + `SportsEventCacheStore`, so they're unit-testable with fakes, no Prisma import); a failed league fetch is caught and skipped so prior cached rows for that league are left untouched (fallback behavior); `invalidateStaleEvents` recomputes and persists freshness for every row
- `@surescore/shared`'s `computeFreshness`/`CacheFreshness` marks rows "live" (recently refreshed live match), "cached" (recently refreshed fixture, or any finished/abandoned result), or "stale" (aged past the job cadence tolerance)
- src/index.ts `scheduled()` dispatches on `controller.cron`: `"0 */4 * * *"` runs fixture prefetch, `"*/10 * * * *"` runs live score refresh + stale invalidation (crons declared in wrangler.jsonc `triggers.crons`)
- League mapping comes from `@surescore/shared`'s `sportsProviderConfigs[].leagues`, never hardcoded at the call site
- test/sports/*.spec.ts: `cache-freshness.spec.ts` covers the freshness policy, `sports-ingestion.spec.ts` covers prefetch/live-refresh/invalidate against fake provider + store (provider outage fallback, freshness marking)

## Settlement, refunds and payouts (Epic 9)
- `@surescore/shared` settlement.ts: `regulationOutcome` (settles only on an official "full time" result, so extra time/penalties never count), `splitPrizePool` (90% winner pool / 10% fee), `distributePrizes` (50/30/20; 100 for 1 winner, 60/40 for 2; fewer players than slots uses the split for the player count; ties merge slots and split equally, leftover minor units go to the earliest tied entries so payouts sum exactly to the pool)
- src/lib/settlement-service.ts: `settleAll()` runs on the 10-minute cron after `syncStatuses` and settles pots in "Settling": ranks persisted predictions, enqueues payouts (key `payout:{potId}:{userId}`) and moves the pot to Paid. Re-runs are safe (compare-and-set transition + ledger check in the queue consumer). A pot with no predictions is cancelled and refunded; a winner without a payout account gets a failed ledger row for admin retry
- Refunds for postponed/abandoned matches are initiated by `PotService.cancel` (via `syncStatuses`) through the transfer queue
- `GET /pots/:id/settlement` returns latest payout/refund status from the ledger (potter: all payouts + refund; player: own payout)
- Signup never accepts a country: it is taken from `request.cf.country` and falls back to Nigeria (`resolveSignupCountry`)

## Product rules enforced here
- Country and provider selection are configuration-driven, not hardcoded
- User payout details must exist before a first prediction is allowed
- Match settlement and payout logic should remain in domain/shared layers, not provider adapters
- Use Chanfana exceptions instead of ad hoc error payloads where possible

## Important files
- src/router.ts
- src/index.ts
- src/lib/auth.ts
- src/lib/middleware.ts
- src/routes/auth/index.ts
- src/routes/config/index.ts
- src/routes/payout-accounts/index.ts

## Commands
- pnpm --filter @surescore/api dev
- pnpm --filter @surescore/api build
- pnpm --filter @surescore/api test

## Notes
- Auth tokens are JWTs signed with HS256 and validated against a KV-backed session hash.
- Local Prisma/Wrangler test/runtime issues exist in this repo; do not treat them as normal feature work unless the task is specifically about the DB runtime.
