# SureScore UI Service

This folder is the Vite + React service for the SureScore monorepo.

## Rules

a. This UI is part of the SureScore monorepo and must remain aligned with the root product requirements in the repository AGENTS.md.

b. Use Vite + React for the frontend, not Next.js.

c. Deploy the built static bundle as a Cloudflare Worker with static assets (SPA mode), not classic Cloudflare Pages.

d. Keep the app mobile-first and optimized for future Android and iOS packaging.

e. Follow the SureScore brand colors: black background (#1b1e25), red brand accent (#DB0007), white text, and green links where appropriate.

f. Do not add provider-specific logic to UI code; keep provider concerns in the backend service layer.

g. Keep changes small and focused, and preserve the monorepo structure.
