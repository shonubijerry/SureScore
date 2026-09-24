# API routes context map

## Route organization
- Resource-based modules under src/routes/{resource}/
- Each resource has an index.ts that mounts nested endpoints
- Each endpoint lives in its own file as a Chanfana OpenAPIRoute subclass

## Current resource groups
- auth/
  - signup, login, logout, me
- config/
  - countries, payment-providers, sports-providers
- payout-accounts/
  - list, create, update, delete

## Pattern
- Use fromHono(new Hono<AppEnv>()) for each resource router
- Use resource index to register endpoints with .get/.post/.patch/.delete
- Keep schemas close to each resource, e.g. payout-accounts/schema.ts
- Prefer Chanfana exceptions for API outcomes

## Key files
- src/router.ts
- src/routes/auth/index.ts
- src/routes/config/index.ts
- src/routes/payout-accounts/index.ts

## Rule to preserve
- One endpoint = one file = one responsibility.
- Keep provider adaptation outside this layer.
- Keep route logic thin and delegate core product policy to shared/domain logic.
