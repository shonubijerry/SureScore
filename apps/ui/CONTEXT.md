# UI package context map

## Purpose
- Vite + React frontend for the SureScore product.
- Mobile-first customer experience intended to support eventual Android/iOS packaging.
- Keeps product-facing flows separate from backend provider specifics.

## Structure
- src/App.tsx: primary app shell and screen composition
- src/main.tsx: app bootstrap
- src/index.css: global styling and theme tokens
- components/: reusable UI and configuration-driven shadcn-style components
- components/theme-provider.tsx: theme state
- lib/utils.ts: shared client utility helpers (shadcn `cn`)

## Folder layout (src/)
- features/{feature}/: everything for one product area, with pages/ (route screens, `*-page.tsx`) and components/ (used only by that feature)
  - auth/: auth-context.tsx (session + auth calls), pages (sign in/up, forgot password), components/otp-step.tsx
  - matches/: pages (matches, match detail, league), components (match card, match tabs, league grid)
  - pots/: pages (public pots, pot detail, create pot, my pots), components (pot list: the one pot-card grid used by every pot list, pot card, prediction form, leaderboard, share buttons), share.ts
  - account/: profile page, payout accounts + modal
  - admin/: back-office pages and components (admin layout, table kit)
  - home/, help/: home page, FAQ
- components/: generic building blocks used across features (layout, modal, bits, info tip, phone field)
- lib/: app-wide plumbing (API client, useApi/usePaged hooks, formatters, API types)
- Every list uses `usePaged` (lib/use-paged.ts: 1000 rows per request, 50 per screen page, "Load more" by cursor) and renders `pageItems` with `Pager` (components/pager.tsx); a full in-memory list uses `usePages`. Sizes live in @surescore/shared pagination
- Put new code in its feature folder; promote it to components/ or lib/ only once a second feature needs it

## Product conventions
- Keep UI mobile-first and lightweight
- Prefer shared UI primitives over custom styling
- Keep country/provider logic in shared backend config, not UI hardcoding
- Treat the app as a consumer of API contracts rather than a home for business rules

## Important files
- src/App.tsx (routes, lazy-loaded pages)
- src/features/* (pages and feature components, see Folder layout)
- src/components/* (layout with mobile bottom nav, shared building blocks)
- src/lib/* (api client, hooks, formatters, types)
- src/main.tsx
- src/index.css
- components/theme-provider.tsx
- components/ui/*

## Commands
- pnpm --filter @surescore/ui dev
- pnpm --filter @surescore/ui build
- pnpm --filter @surescore/ui lint

Dev: the Vite server proxies /api to the Worker on :8787 (run `pnpm dev`); set VITE_API_URL for deployed builds.
