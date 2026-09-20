# SureScore UI

This is the Vite + React frontend service for the SureScore monorepo.

## Stack

a. Vite + React

b. Tailwind CSS for styling

c. Cloudflare Pages friendly build output

## Local development

```bash
pnpm --filter @surescore/ui dev
```

## Production build

```bash
pnpm --filter @surescore/ui build
```

## Brand theme

a. Global background: #1b1e25

b. Brand color: #DB0007

c. Primary text: white

d. Supporting links: green

## Deployment target

The UI is intended to be deployed as a Cloudflare Pages static site from the built `dist` directory.
