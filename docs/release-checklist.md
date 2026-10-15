# Nigeria launch release checklist

Tick every box before promoting a release. Commands run from the repo root.

## 1. Build and verification
- [ ] `pnpm --filter @surescore/api exec tsc --noEmit` and `pnpm --filter @surescore/ui typecheck && pnpm --filter @surescore/ui lint` pass.
- [ ] `pnpm --filter @surescore/api test` passes (e2e: create pot → fund → predict → settle → payout).
- [ ] Manual mobile pass (≈375px wide) of: sign up, create pot, fund/verify, predict, pot detail, wallet/payout details, admin payouts + pots.

## 2. Database (D1)
- [ ] `wrangler d1 migrations apply surescore_db --remote` (includes `0008_hardening`: encrypted account numbers + hash/last4 columns).
- [ ] Legacy plaintext payout accounts are still readable (decrypt passes them through); re-save to encrypt, or backfill with a one-off script before launch.

## 3. Secrets and bindings
- [ ] `wrangler secret put AUTH_SECRET` (long random value, not the dev default).
- [ ] `wrangler secret put PAYSTACK_SECRET_KEY` — **live** key (`sk_live_…`) for the NG Paystack account; Paystack dashboard has transfers enabled and a funded balance.
- [ ] `wrangler secret put PAYOUT_ENCRYPTION_KEY` — random 32+ chars. Store it in the team vault: losing or rotating it makes stored account numbers undecryptable.
- [ ] `wrangler secret put ALERT_WEBHOOK_URL` (Slack/Discord-compatible incoming webhook) — optional, alerts are always logged.
- [ ] `SESSIONS` KV namespace id replaced in `apps/api/wrangler.jsonc` (no `__CLOUDFLARE_KV_SESSIONS_ID__` placeholder).
- [ ] Queues `surescore-transfers` and `surescore-transfers-dlq` exist; DLQ is monitored.
- [ ] Paystack/ESPN API keys exist only as secrets, never in the repo.

## 4. Nigeria configuration
- [ ] Country config: NG launched, currency NGN, payment provider `paystack`, sports provider `espn` (`packages/shared`).
- [ ] Signup falls back to NG for unknown/non-launched countries (`resolveSignupCountry`).
- [ ] Fee rules verified: 10% platform fee, 90% winner pool, default 50/30/20 for three winners, regulation time only.
- [ ] Lock = kickoff − 15 min; potter cancel allowed until kickoff − 20 min.

## 5. Provider mapping
- [ ] Paystack: `POST /transaction/initialize`, `/transaction/verify/:ref`, `/transfer`, `/refund` succeed against the live account with a small real transaction; webhook-free verification path works.
- [ ] ESPN league mapping lists every launch league (e.g. `eng.1`, `nga.1`, `uefa.champions`) in the sports provider config; each returns fixtures from `site.api.espn.com/apis/site/v2/sports/soccer/:league/scoreboard`.

## 6. Scheduled jobs (`wrangler.jsonc` → `triggers.crons`)
- [ ] `0 */4 * * *` fixture prefetch (also prunes job runs).
- [ ] `*/10 * * * *` live-score refresh, pot status sync, settlement, alert dispatch.
- [ ] `0 2 * * *` daily reconciliation.
- [ ] After deploy, `/admin` → Dashboard shows a recent successful run for `fixture-prefetch`, `live-refresh`, `settlement`.

## 7. Security
- [ ] Rate limits active (login 10/15 min/IP, signup 5/h/IP, pot create 10/h/user, predictions 30/min/user); confirm a 429 with `Retry-After`.
- [ ] API responses carry `Cache-Control: no-store` and HSTS; site served over HTTPS only.
- [ ] Payout API responses show only `••••last4`; D1 `PayoutAccount.accountNumber` values start with `enc:v1:`.
- [ ] First admin created directly in D1 (`UPDATE User SET role='admin' WHERE email=…`); all other staff created via Admin → Staff. Staff role is read-only + notes.

## 8. Observability and audit
- [ ] Workers Logs enabled (`observability.enabled`); filter by `scope` = `sync | payout | refund | fund | settlement | job | alert | audit`.
- [ ] Alert test: temporarily trigger a failed job or stale data and confirm the webhook message (deduped hourly).
- [ ] Audit completeness: every admin mutation and payout-account change appears in Admin → Audit log with actor and reason (covered by `test/admin/staff.spec.ts`; actions listed in `apps/api/src/modules/admin/audit.ts`). Financial actions are additionally in the immutable ledger.
- [ ] Reconciliation shows no open critical findings.

## 9. Go / no-go and rollback
- [ ] Smoke test in production: sign up, create a small pot, fund, predict, cancel/refund.
- [ ] Rollback: `wrangler rollback` for the Worker; migrations are additive (`0008` adds nullable columns), so no DB rollback is required. Pause crons by removing triggers if settlement misbehaves; use Admin → Payouts to retry failed transfers.
