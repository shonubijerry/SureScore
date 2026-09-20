# SureScore

SureScore is now scaffolded as a minimal pnpm-workspaces monorepo with:

- `apps/ui` — React + Vite frontend ready to deploy to Cloudflare Pages
- `apps/api` — Cloudflare Worker API
- `packages/shared` — shared UI/API metadata and types
- `packages/db` — Prisma + Cloudflare D1 database package using the no-engine client

## Getting started

```bash
pnpm install
pnpm build
pnpm test
```

## Monorepo layout

```text
.
├── apps
│   ├── api
│   └── ui
├── packages
│   ├── db
│   └── shared
└── .github/workflows
```

## Cloudflare configuration

The deploy workflow expects these GitHub secrets/variables:

- `secrets.CLOUDFLARE_API_TOKEN`
- `secrets.CLOUDFLARE_ACCOUNT_ID`
- `vars.CLOUDFLARE_PAGES_PROJECT`
- `vars.CLOUDFLARE_D1_DATABASE_ID`

The worker is configured with a default D1 database name of `surescore-db`. If you use a different database name, update `/home/runner/work/SureScore/SureScore/apps/api/wrangler.jsonc` and `/home/runner/work/SureScore/SureScore/.github/workflows/deploy.yml` together.
