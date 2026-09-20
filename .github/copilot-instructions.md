# SureScore Copilot Instructions

This repository is for SureScore, a social football prediction app.

Follow this product requirements document for all future engineering and product changes.

## Product source of truth

a. SureScore is a football prediction platform where a potter creates a funded prediction pot tied to a match.

b. Users predict scores before lock, the app ranks predictions on a leaderboard, and winners are paid automatically after final settlement.

c. Nigeria is the initial launch market, but the architecture must support future country expansion.

## Strict rules

a. Match settlement uses 90 minutes of regulation time only, including stoppage time.

b. Extra time and penalties do not count for scoring or payout settlement.

c. Prediction lock is 15 minutes before kickoff.

d. Potter cancellation is allowed only until 20 minutes before kickoff.

e. Postponed or abandoned matches trigger immediate refund initiation.

f. Platform fee is 10% of the funded pot prize.

g. Winner pool is 90% of the funded pot prize.

h. For a three-winner pot, default split is 50/30/20 of the winner pool.

i. If a tie occurs across prize boundaries, merge the affected slots and split equally among tied users.

j. There is no cross-currency payout conversion; each supported country uses its own local payout currency.

## Provider rules

a. Paystack is the initial payment provider for Nigeria.

b. Payment provider selection is country-based and configuration-driven.

c. ESPN soccer scoreboard APIs are the initial sports data source.

d. The app must support swapping providers through a common interface.

e. Do not hardcode ESPN or Paystack logic into core domain code.

## Architecture rules

a. Use Vite + React for the frontend.

b. Use Cloudflare Workers for the API layer.

c. Prefer Cloudflare-native infrastructure where appropriate.

d. Keep the UI mobile-first and ready for eventual Android and iOS packaging.

e. Keep product logic separated from provider-specific adapters.

## Data and operational rules

a. Prefetch events and store them to reduce API cost.

b. Refresh events every 4 hours.

c. Refresh live scores every 10 minutes.

d. Keep immutable ledger records for all financial actions.

e. All payout, refund, and settlement actions must be idempotent and auditable.

## Required implementation order

a. Platform foundation and shared infrastructure.

b. Identity, country, and configuration model.

c. Provider abstraction for payments and sports data.

d. Sports data ingestion and cache.

e. Wallet, ledger, and payment flows.

f. Pot lifecycle and creation.

g. Prediction and scoring engine.

h. Home, discovery, and pot detail UI.

i. Settlement, refunds, and payouts.

j. Admin operations and exception handling.

k. Launch hardening and observability.

## Change guidance

a. Preserve the architecture and product rules above when making changes.

b. Prefer small, focused changes over broad rewrites.

c. If a proposal conflicts with this document, clarify and resolve the conflict before coding.

d. Features that affect scoring, payout, settlement, provider behavior, or country logic must be reasoned about carefully and verified before completion.

e. Keep this file and AGENTS.md aligned with future product decisions.
