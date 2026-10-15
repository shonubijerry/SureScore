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

## Folder layout (group by concern; never add a catch-all folder)
- src/routes/{resource}/: HTTP endpoints only (one Chanfana class per file); they call modules, never Prisma-heavy logic inline
- src/modules/{domain}/: business logic, one folder per domain
  - auth/: session.ts (JWT + KV sessions, revocation), password.ts, signup.ts, password-reset.ts, otp/ (code.ts generation + hashing, challenge.ts limits, channels.ts email/SMS delivery)
  - pots/: pot-service.ts (lifecycle), pot-access.ts (private pots), prediction-service.ts, settlement-service.ts
  - payments/: ledger.ts (append-only), transfer-queue.ts (payouts/refunds), payout-recipient.ts, reconciliation-service.ts
  - sports/: cache-repository.ts, ingestion.ts (prefetch/live refresh/freshness), cleanup.ts (old-match pruning)
  - admin/: ops.ts, pots.ts, staff.ts, transfers.ts, alerts.ts, audit.ts
- src/http/: request/response plumbing shared by routes: middleware.ts (auth guards), rate-limit.ts, openapi.ts, pagination.ts, views.ts (match/pot response shapes)
- src/platform/: cross-cutting infrastructure: logger.ts, job-runs.ts, chunk.ts (D1 `in` batching), secure-data.ts (account-number encryption)
- src/providers/{payment,sports,sms,email}/: third-party adapters only, plus registry.ts
- test/ mirrors src: test/{admin,auth,payments,pots,sports,http,platform,providers}, test/rules + test/identity for @surescore/shared rules, test/e2e for full flows; DB-backed specs call `applyMigrations` from test/helpers/db.ts

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
- src/modules/sports/cache-repository.ts: `SportsEventCacheStore` interface (store-agnostic) + `PrismaSportsEventCacheStore` adapter over the `SportsEventCache` D1 table; cache row id is `"{provider}:{externalId}"`
- src/modules/sports/ingestion.ts: `prefetchFixtures`/`refreshLiveScores` (pure functions over `SportsProvider` + `SportsEventCacheStore`, so they're unit-testable with fakes, no Prisma import); a failed league fetch is caught and skipped so prior cached rows for that league are left untouched (fallback behavior); `invalidateStaleEvents` recomputes and persists freshness for every row
- `@surescore/shared`'s `computeFreshness`/`CacheFreshness` marks rows "live" (recently refreshed live match), "cached" (recently refreshed fixture, or any finished/abandoned result), or "stale" (aged past the job cadence tolerance)
- src/index.ts `scheduled()` dispatches on `controller.cron`: `"0 */4 * * *"` runs fixture prefetch + old-match cleanup, `"*/10 * * * *"` runs live score refresh + stale invalidation (crons declared in wrangler.jsonc `triggers.crons`)
- Stale invalidation only relabels freshness; it never deletes. src/modules/sports/cleanup.ts `pruneOldMatches` deletes matches 7+ days past kickoff unless one of their pots was paid for (successful fund ledger row or a funded pot state); unpaid pots on a removed match go with it, ledger rows are never deleted
- League mapping comes from `@surescore/shared`'s `sportsProviderConfigs[].leagues`, never hardcoded at the call site
- test/rules/cache-freshness.spec.ts covers the freshness policy; test/sports/ingestion.spec.ts covers prefetch/live-refresh/invalidate against fake provider + store (provider outage fallback, freshness marking)

## Settlement, refunds and payouts (Epic 9)
- `@surescore/shared` settlement.ts: `regulationOutcome` (settles only on an official "full time" result, so extra time/penalties never count), `splitPrizePool` (90% winner pool / 10% fee), `distributePrizes` (50/30/20; 100 for 1 winner, 60/40 for 2; fewer players than slots uses the split for the player count; ties merge slots and split equally, leftover minor units go to the earliest tied entries so payouts sum exactly to the pool)
- src/modules/pots/settlement-service.ts: `settleAll()` runs on the 10-minute cron after `syncStatuses` and settles pots in "Settling": ranks persisted predictions, enqueues payouts (key `payout:{potId}:{userId}`) and moves the pot to Paid. Re-runs are safe (compare-and-set transition + ledger check in the queue consumer). A pot with no predictions is cancelled and refunded; a winner without a payout account gets a failed ledger row for admin retry
- Refunds for postponed/abandoned matches are initiated by `PotService.cancel` (via `syncStatuses`) through the transfer queue
- `GET /pots/:id/settlement` returns latest payout/refund status from the ledger (potter: all payouts + refund; player: own payout)
- Signup never accepts a country: it is taken from `request.cf.country` and falls back to Nigeria (`resolveSignupCountry`)

## Admin operations and reconciliation (Epic 10)
- `/api/admin/*` requires `requireAuth` + `requireAdmin` (`User.role = "admin"`; no admin exists by default). Route files are grouped under `src/routes/admin/`.
- Every admin mutation requires a reason (min 5 chars) and writes an `AdminAuditLog` row. Pot notes, disputes and overrides share that log.
- Pots: `GET /pots/summary`, `/pots`, `/pots/:id`; `POST /pots/:id/{notes,dispute,dispute/resolve,settlement-override}`. Disputes use the `Disputed` pot state (only from Settling/Paid); resolving returns the pot to its origin. Override (`SettlementOverride`, one per pot, blocked after payouts) is honoured by `SettlementService.settle`.
- Transfers: `GET /payouts`, `/refunds` (latest ledger state per action); `POST /transfers/retry`. Retry enqueues with `attemptOffset` so the new ledger `entryKey` never collides with earlier attempts. Payout retry uses the user's current payout account.
- Ops: `GET /health` (provider health from ledger/cache + `JobRun`), `GET /ledger` (search by email, reference, key, pot, user).
- Reconciliation: pure rules in `packages/shared/src/rules/reconciliation.ts`, run by `ReconciliationService` daily (cron `0 2 * * *`) or on demand (`POST /reconciliation/run`). Findings are deduplicated by fingerprint and reviewed via `/reconciliation/findings/:id/resolve`.
- Scheduled jobs are recorded in `JobRun` via `trackJob` (14-day retention).
- UI: `apps/ui/src/features/admin/` at `/admin` (staff and admins).
- D1 limits bound parameters; use `inChunks` for `in` queries.

## Product rules enforced here
- Country and provider selection are configuration-driven, not hardcoded
- User payout details must exist before a first prediction is allowed
- Match settlement and payout logic should remain in domain/shared layers, not provider adapters
- Use Chanfana exceptions instead of ad hoc error payloads where possible

## Important files
- src/router.ts
- src/index.ts
- src/modules/auth/session.ts
- src/http/middleware.ts
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
