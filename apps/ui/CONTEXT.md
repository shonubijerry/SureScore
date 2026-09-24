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
- lib/utils.ts: shared client utility helpers

## Product conventions
- Keep UI mobile-first and lightweight
- Prefer shared UI primitives over custom styling
- Keep country/provider logic in shared backend config, not UI hardcoding
- Treat the app as a consumer of API contracts rather than a home for business rules

## Important files
- src/App.tsx
- src/main.tsx
- src/index.css
- components/theme-provider.tsx
- components/ui/*

## Commands
- pnpm --filter @surescore/ui dev
- pnpm --filter @surescore/ui build
- pnpm --filter @surescore/ui lint
