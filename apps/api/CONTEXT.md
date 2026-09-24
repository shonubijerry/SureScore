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
- Keep one endpoint per file and mount nested routers from each index.ts

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
