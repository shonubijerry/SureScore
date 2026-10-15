// Pure ledger reconciliation rules. They compare what the pot lifecycle says
// happened with what the immutable ledger recorded, and flag anything that
// looks like a leak, a duplicate, or fraud. No I/O so every rule is testable.

import { refundAmountFor, splitPrizePool } from "./settlement.js";

export type FindingSeverity = "critical" | "high" | "medium";

export const reconciliationCodes = [
  "FUND_MISSING",
  "FUND_AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  "PAYOUT_EXCEEDS_POOL",
  "PAYOUT_BEFORE_SETTLEMENT",
  "PAYOUT_AND_REFUND",
  "PAYOUT_NON_PARTICIPANT",
  "PAYOUT_MISSING",
  "POTTER_WON_OWN_POT",
  "REFUND_MISSING",
  "REFUND_AMOUNT_MISMATCH",
  "REFUND_WITHOUT_CANCELLATION",
  "REFUNDED_WITHOUT_REFUND",
  "DUPLICATE_SUCCESS",
  "STALE_PENDING",
  "UNRESOLVED_FAILURE",
  "SHARED_PAYOUT_ACCOUNT",
] as const;
export type ReconciliationCode = (typeof reconciliationCodes)[number];

export interface ReconciliationFindingInput {
  code: ReconciliationCode;
  severity: FindingSeverity;
  potId?: string;
  userId?: string;
  detail: string;
  /** Stable identity of the anomaly so re-runs do not duplicate it. */
  fingerprint: string;
}

export interface ReconPot {
  id: string;
  status: string;
  currency: string;
  prizeAmountMinorUnits: number;
  potterId: string;
  updatedAt: Date;
  /** Cancelled while still unfunded, so no refund is owed. */
  cancelledBeforeFunding: boolean;
  /** Reason recorded when the pot was cancelled; decides the refund amount owed. */
  refundReason?: string | null;
  predictionCount: number;
}

/** Ledger rows of one financial action and status (a grouped aggregate, not raw rows). */
export interface ReconLedgerGroup {
  idempotencyKey: string;
  potId: string;
  userId: string;
  type: "fund" | "refund" | "payout";
  status: "pending" | "successful" | "failed";
  currency: string;
  amountMinorUnits: number;
  rows: number;
  lastAt: Date;
}

export interface ReconciliationInput {
  pots: ReconPot[];
  groups: ReconLedgerGroup[];
  /** "potId:userId" of every prediction placed on the pots under review. */
  participants: ReadonlySet<string>;
  /** Payout accounts used by more than one user: account key -> user ids. */
  sharedAccounts: ReadonlyMap<string, readonly string[]>;
  now: Date;
}

export const GRACE_HOURS = 1;
export const STALE_PENDING_HOURS = 24;
export const UNRESOLVED_FAILURE_HOURS = 72;

const FUNDED_STATUSES = new Set(["Funded", "Open", "Locked", "Live", "Settling", "Paid", "Disputed"]);
const hoursSince = (from: Date, now: Date) => (now.getTime() - from.getTime()) / 3_600_000;
export const participantKey = (potId: string, userId: string) => `${potId}:${userId}`;

interface Action {
  key: string;
  userId: string;
  currency: string;
  amount: number;
  /** Best status across attempts: successful > pending > failed. */
  state: ReconLedgerGroup["status"];
  successRows: number;
  lastAt: Date;
}

const STATE_RANK = { failed: 0, pending: 1, successful: 2 } as const;

function actionsByType(groups: ReconLedgerGroup[]) {
  const byKey = new Map<string, Action & { type: ReconLedgerGroup["type"] }>();
  for (const g of groups) {
    const action = byKey.get(g.idempotencyKey);
    if (!action) {
      byKey.set(g.idempotencyKey, {
        key: g.idempotencyKey,
        type: g.type,
        userId: g.userId,
        currency: g.currency,
        amount: g.amountMinorUnits,
        state: g.status,
        successRows: g.status === "successful" ? g.rows : 0,
        lastAt: g.lastAt,
      });
      continue;
    }
    if (STATE_RANK[g.status] > STATE_RANK[action.state]) action.state = g.status;
    if (g.status === "successful") action.successRows += g.rows;
    if (g.lastAt > action.lastAt) action.lastAt = g.lastAt;
  }
  const result = { fund: [] as Action[], refund: [] as Action[], payout: [] as Action[] };
  for (const { type, ...action } of byKey.values()) result[type].push(action);
  return result;
}

const committed = (actions: Action[]) => actions.filter((a) => a.state !== "failed");
const total = (actions: Action[]) => actions.reduce((sum, a) => sum + a.amount, 0);

export function reconcile({ pots, groups, participants, sharedAccounts, now }: ReconciliationInput) {
  const findings: ReconciliationFindingInput[] = [];
  const groupsByPot = new Map<string, ReconLedgerGroup[]>();
  for (const g of groups) groupsByPot.set(g.potId, [...(groupsByPot.get(g.potId) ?? []), g]);

  for (const pot of pots) {
    const potGroups = groupsByPot.get(pot.id) ?? [];
    const actions = actionsByType(potGroups);
    const quiet = hoursSince(pot.updatedAt, now) >= GRACE_HOURS;
    const flag = (
      code: ReconciliationCode,
      severity: FindingSeverity,
      detail: string,
      subject = "",
      userId?: string,
    ) => findings.push({ code, severity, potId: pot.id, userId, detail, fingerprint: `${code}:${pot.id}:${subject}` });

    const funded = actions.fund.filter((a) => a.state === "successful");
    const payouts = committed(actions.payout);
    const refunds = committed(actions.refund);
    const { winnerPool } = splitPrizePool(pot.prizeAmountMinorUnits);

    if (FUNDED_STATUSES.has(pot.status) && funded.length === 0) {
      flag("FUND_MISSING", "critical", `Pot is ${pot.status} but has no confirmed funding.`);
    }
    if (funded.length > 0 && total(funded) !== pot.prizeAmountMinorUnits) {
      flag("FUND_AMOUNT_MISMATCH", "critical", `Funded ${total(funded)} but prize is ${pot.prizeAmountMinorUnits}.`);
    }
    for (const g of potGroups) {
      if (g.currency !== pot.currency) {
        flag("CURRENCY_MISMATCH", "high", `${g.type} ${g.idempotencyKey} is in ${g.currency}, pot is ${pot.currency}.`, g.idempotencyKey);
      }
      if (g.status === "successful" && g.rows > 1) {
        flag("DUPLICATE_SUCCESS", "critical", `${g.rows} successful rows for ${g.idempotencyKey}.`, g.idempotencyKey, g.userId);
      }
    }

    if (total(payouts) > winnerPool) {
      flag("PAYOUT_EXCEEDS_POOL", "critical", `Payouts ${total(payouts)} exceed the winner pool ${winnerPool}.`);
    }
    if (payouts.length > 0 && pot.status !== "Paid" && pot.status !== "Disputed") {
      flag("PAYOUT_BEFORE_SETTLEMENT", "critical", `Payouts exist while the pot is ${pot.status}.`);
    }
    if (payouts.length > 0 && refunds.length > 0) {
      flag("PAYOUT_AND_REFUND", "critical", "Pot has both payouts and a refund: the prize was paid twice.");
    }
    for (const payout of payouts) {
      if (!participants.has(participantKey(pot.id, payout.userId))) {
        flag("PAYOUT_NON_PARTICIPANT", "critical", `Payout ${payout.key} went to a user with no prediction.`, payout.key, payout.userId);
      }
      if (payout.userId === pot.potterId) {
        flag("POTTER_WON_OWN_POT", "medium", "The potter won their own pot; review for self-dealing.", payout.key, payout.userId);
      }
    }
    if (pot.status === "Paid" && pot.predictionCount > 0 && actions.payout.length === 0 && quiet) {
      flag("PAYOUT_MISSING", "high", "Pot is Paid but no payout was ever recorded.");
    }

    if (refunds.length > 0 && !["Cancelled", "Refunded"].includes(pot.status)) {
      flag("REFUND_WITHOUT_CANCELLATION", "high", `Refund recorded while the pot is ${pot.status}.`);
    }
    const refundOwed = refundAmountFor(pot.prizeAmountMinorUnits, pot.refundReason);
    if (refunds.length > 0 && total(refunds) !== refundOwed) {
      flag("REFUND_AMOUNT_MISMATCH", "high", `Refunded ${total(refunds)} but ${refundOwed} is owed.`);
    }
    if (pot.status === "Cancelled" && !pot.cancelledBeforeFunding && refunds.length === 0 && quiet) {
      flag("REFUND_MISSING", "high", "Funded pot was cancelled but no refund was initiated.");
    }
    if (pot.status === "Refunded" && !actions.refund.some((a) => a.state === "successful")) {
      flag("REFUNDED_WITHOUT_REFUND", "critical", "Pot is Refunded but no refund succeeded.");
    }

    for (const action of [...actions.payout, ...actions.refund]) {
      const age = hoursSince(action.lastAt, now);
      if (action.state === "pending" && age >= STALE_PENDING_HOURS) {
        flag("STALE_PENDING", "medium", `${action.key} has been pending for ${Math.floor(age)}h.`, action.key, action.userId);
      }
      if (action.state === "failed" && age >= UNRESOLVED_FAILURE_HOURS) {
        flag("UNRESOLVED_FAILURE", "medium", `${action.key} has been failing for ${Math.floor(age)}h.`, action.key, action.userId);
      }
    }
  }

  for (const [account, userIds] of sharedAccounts) {
    findings.push({
      code: "SHARED_PAYOUT_ACCOUNT",
      severity: "medium",
      detail: `${userIds.length} users share payout account ending ${account.slice(-4)}.`,
      fingerprint: `SHARED_PAYOUT_ACCOUNT::${account}`,
    });
  }
  return findings;
}

export interface CurrencyTotals {
  fundedMinorUnits: number;
  paidOutMinorUnits: number;
  refundedMinorUnits: number;
  pendingOutMinorUnits: number;
  failedOutMinorUnits: number;
  platformFeeMinorUnits: number;
}

/** Money in/out per currency; the platform fee counts for pots that paid out or were refunded with no winner. */
export function summarizeLedger(pots: ReconPot[], groups: ReconLedgerGroup[]): Record<string, CurrencyTotals> {
  const summary: Record<string, CurrencyTotals> = {};
  const row = (currency: string) =>
    (summary[currency] ??= {
      fundedMinorUnits: 0,
      paidOutMinorUnits: 0,
      refundedMinorUnits: 0,
      pendingOutMinorUnits: 0,
      failedOutMinorUnits: 0,
      platformFeeMinorUnits: 0,
    });

  for (const pot of pots) {
    const keptFee = pot.status === "Paid" || (pot.refundReason === "no-winner" && (pot.status === "Cancelled" || pot.status === "Refunded"));
    if (keptFee) row(pot.currency).platformFeeMinorUnits += splitPrizePool(pot.prizeAmountMinorUnits).platformFee;
  }
  for (const [type, actions] of Object.entries(actionsByType(groups))) {
    for (const action of actions) {
      const totals = row(action.currency);
      if (type === "fund" && action.state === "successful") totals.fundedMinorUnits += action.amount;
      if (type === "payout" && action.state === "successful") totals.paidOutMinorUnits += action.amount;
      if (type === "refund" && action.state === "successful") totals.refundedMinorUnits += action.amount;
      if (type !== "fund" && action.state === "pending") totals.pendingOutMinorUnits += action.amount;
      if (type !== "fund" && action.state === "failed") totals.failedOutMinorUnits += action.amount;
    }
  }
  return summary;
}
