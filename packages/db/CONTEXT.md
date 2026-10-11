# Database package context map

## Purpose
- Prisma schema, migrations, and generated D1 client for SureScore.
- Relational data remains in D1; session state is intentionally kept out of the DB.

## Structure
- prisma/schema.prisma: canonical schema source
- prisma/migrations/: migration history
- src/index.ts: DB client factory export
- generated/client/: generated Prisma client; do not edit by hand

## Core models
- User: account identity, country, auth metadata, payout accounts relation
- PayoutAccount: user payout details tied to country and provider
- Prediction / PredictionEdit: one prediction per user per pot, with append-only edit history
- SportsEventCache: normalized/cached sports events (id `"{provider}:{externalId}"`), match status, scores, freshness ("live"/"cached"/"stale"), and last refresh timestamp — the only sports data table the rest of the app reads from

## Important rules
- Run Prisma generation after schema changes
- Treat generated client as build output, not a hand-edited source file
- Keep provider-shape logic outside Prisma schema concerns

## Commands
- pnpm --filter @surescore/db generate
- pnpm --filter @surescore/db build
- pnpm --filter @surescore/db migration <name>: write SQL for schema changes as the next prisma/migrations/NNNN_name (uses a throwaway shadow DB; no database file needed)
- pnpm --filter @surescore/api db:migrate:local: apply migrations to the local Miniflare D1 (recreated from scratch if `apps/api/.wrangler/state` is deleted)
- pnpm --filter @surescore/api db:migrate:remote: apply migrations to Cloudflare D1

## Notes
- This package is for durable, relational data only.
- High-frequency session/token state belongs in KV, not D1.
