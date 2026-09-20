# SureScore AGENTS

This repository is for SureScore, a social football prediction platform.

Use this document as the product source of truth for all future modifications.

## Product mission

a. SureScore is a social football prediction platform where a potter creates a funded prediction pot tied to a football match.

b. Users submit score predictions before a lock window closes, the platform ranks them on a leaderboard, and winners are paid after match settlement.

c. The launch market is Nigeria first, with architecture designed for future country expansion without reworking the core product model.

## Core product rules

a. Match settlement uses 90 minutes of regulation time only, including stoppage time.

b. Extra time and penalty shootouts are excluded from scoring and payout calculations.

c. Prediction lock is 15 minutes before kickoff.

d. Potter cancellation is allowed only until 20 minutes before kickoff.

e. Postponed or abandoned matches trigger immediate refund initiation.

f. Refund completion timing depends on the payment provider’s processing timeline.

g. Failed payouts are retried by admins, and users may update payout details to support retries.

h. The product must not assume one country forever; country and provider logic must be configuration-driven.

## Launch scope and country rules

a. Nigeria is the initial launch market.

b. The product must support future country expansion through configuration and provider mapping.

c. Each supported country uses its own local payout currency.

d. No cross-currency conversion is allowed for winner payouts.

e. Country selection at signup determines payout currency rules, provider availability, and participation eligibility.

## Payment model and provider rules

a. Paystack is the initial payment provider for Nigeria.

b. Payment provider selection must be country-based and configuration-driven.

c. The payment layer must expose a common interface for pot funding, refunds, winner payouts, payout retries, and payment status verification.

d. Provider-specific request and response formats must be isolated behind adapters.

e. Platform fee is 10% of the funded pot prize.

f. Winner pool is 90% of the funded pot prize.

g. Default winner split for a three-winner pot is 50%, 30%, and 20% of the winner pool, in rank order.

h. If a tie occurs within or across prize boundaries, merge the affected slots and split equally among tied users.

## Sports data and provider rules

a. ESPN soccer scoreboard APIs are the initial source for fixtures and live scores.

b. Initial endpoint pattern: http://site.api.espn.com/apis/site/v2/sports/soccer/:league/scoreboard

c. Sports provider selection must be swappable through configuration and adapter replacement.

d. The system must normalize provider-specific responses into a common internal match schema.

e. The sports layer must support league mapping configuration and provider abstraction.

## Data freshness

a. Events and upcoming fixtures are prefetched and stored to reduce upstream API costs.

b. Event data refreshes every 4 hours.

c. Live score data refreshes every 10 minutes.

d. Cached data must remain usable when the upstream provider fails temporarily.

e. Data must record source provider, refresh timestamp, and freshness state.

## Platform and architecture

a. Frontend: Vite + React.

b. Backend API: Cloudflare Workers.

c. Use full Cloudflare infrastructure where appropriate for edge delivery, storage, scheduling, and app operations.

d. The architecture must be mobile-first and suitable for eventual Android and iOS packaging.

e. Business logic must not directly depend on provider-specific DTOs from Paystack or ESPN.

## User roles and permissions

a. Admin manages operational oversight, settlement exceptions, payouts, refunds, and disputes.

b. Potter creates and funds pots, chooses winner count, shares links, and cancels before cutoff.

c. User signs up, saves payout details, submits predictions, views ranking, and receives winnings.

## Functional priorities

Implementation order should follow this priority sequence:

a. Platform foundation and shared infrastructure.

b. Identity, country, and configuration model.

c. Provider abstraction for payments and sports data.

d. Sports data ingestion and caching.

e. Wallet, ledger, and payment flows.

f. Pot lifecycle and pot creation.

g. Prediction and scoring engine.

h. Home, discovery, and pot detail UI.

i. Settlement, refunds, and payouts.

j. Admin operations and exception handling.

k. Hardening, observability, and launch readiness.

## Engineering expectations for future changes

a. Preserve the mobile-first, Cloudflare-first architecture.

b. Keep provider adapters isolated from product logic.

c. Follow the Nigeria-first launch rules but do not hardcode Nigeria in a way that blocks future country expansion.

d. Do not introduce direct ESPN or Paystack logic into core domain modules.

e. Keep all financial actions auditable and idempotent.

f. Keep matching, scoring, and payout rules explicit and testable.

g. Favor minimally invasive changes that preserve the current architecture and product rules.

h. If a feature or change conflicts with this PDR, escalate and clarify before implementation.

## Acceptance standards

a. Changes must be consistent with the product rules and architecture above.

b. New features must not break country-based payout logic.

c. New features must not bypass lock, cancel, or refund policies.

d. New code must maintain provider abstraction boundaries.

e. Changes that affect scoring, payout, settlement, or financial flows must include verification and audit-ready reasoning.

## Required approach when modifying this repo

a. Read the relevant product context in this document before changing API contracts, schemas, or payout logic.

b. Prefer small, well-scoped changes over broad rewrites.

c. Keep architecture aligned with Vite + React UI and Cloudflare Worker backend.

d. Ensure any feature discussion or implementation plan is grounded in this PDR and the project’s stated priority order.
