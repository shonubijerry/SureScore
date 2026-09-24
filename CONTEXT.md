# SureScore repo context map

## Product
- Social football prediction platform with funded pots, leaderboard ranking, and automatic settlement.
- Nigeria is the launch market, but the architecture is config-driven for future country expansion.
- Core business rules:
  - 90 minutes regulation time only; extra time/penalties excluded
  - prediction lock is 15 minutes before kickoff
  - potter cancellation allowed only until 20 minutes before kickoff
  - postponed/abandoned matches trigger immediate refund initiation
  - platform fee is 10% of the funded pot prize
  - winner pool is 90%
  - 3-winner default split is 50/30/20
  - ties merge affected slots and split equally
  - no cross-currency payout conversion

## Architecture
- Monorepo with pnpm workspaces.
- apps/api: Cloudflare Worker API using Hono + Chanfana
- apps/ui: Vite + React frontend
- packages/db: Prisma schema + D1 client
- packages/shared: config and product eligibility rules

## Important implementation patterns
- Keep business logic out of provider-specific adapters.
- Keep country, currency, and provider mapping in shared config.
- Keep auth session state in KV; keep durable relational data in D1.
- Use resource-based route modules, each with a single endpoint per file.
- Use Chanfana OpenAPIRoute classes and shared Zod schemas for request/response validation.
- Use immutable financial ledger patterns and idempotent payout/refund flows.

## Core folders
- [apps/api/src/router.ts](apps/api/src/router.ts)
- [apps/api/src/routes](apps/api/src/routes)
- [apps/api/src/routes/CONTEXT.md](apps/api/src/routes/CONTEXT.md)
- [apps/api/src/lib](apps/api/src/lib)
- [apps/ui/src](apps/ui/src)
- [apps/ui/CONTEXT.md](apps/ui/CONTEXT.md)
- [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma)
- [packages/db/CONTEXT.md](packages/db/CONTEXT.md)
- [packages/shared/src](packages/shared/src)
- [packages/shared/CONTEXT.md](packages/shared/CONTEXT.md)

## Key behaviors already implemented
- signup/login and country-aware auth
- country/provider configuration endpoints
- payout account CRUD flow
- first-prediction payout completion gate in shared eligibility logic
- KV-backed session validation

## Common commands
- pnpm build
- pnpm --filter @surescore/api dev
- pnpm --filter @surescore/ui dev
- pnpm --filter @surescore/shared build
- pnpm --filter @surescore/db generate

## Known caveats
- Local Prisma + Cloudflare/Wrangler test runtime has a known incompatibility in Vitest, unrelated to app logic.
- Build and dry-run validation are the preferred verification path when DB runtime issues appear locally.
