// Pure pot lifecycle rules: states, allowed transitions, lock/cancel cutoffs
// and automatic state derivation. No I/O so every rule is unit-testable.

import type { MatchStatus } from "./providers/sports-provider.js";

export const potStatuses = [
  "Draft",
  "Funded",
  "Open",
  "Locked",
  "Live",
  "Settling",
  "Paid",
  "Cancelled",
  "Refunded",
  "Disputed",
] as const;
export type PotStatus = (typeof potStatuses)[number];

export const PREDICTION_LOCK_MINUTES_BEFORE_KICKOFF = 15;
export const CANCEL_CUTOFF_MINUTES_BEFORE_KICKOFF = 20;
export const MIN_WINNER_COUNT = 1;
export const MAX_WINNER_COUNT = 3;

const allowedTransitions: Record<PotStatus, readonly PotStatus[]> = {
  Draft: ["Funded", "Cancelled"],
  Funded: ["Open", "Cancelled"],
  Open: ["Locked", "Cancelled"],
  Locked: ["Live", "Cancelled"],
  Live: ["Settling", "Cancelled"],
  Settling: ["Paid", "Disputed", "Cancelled"], // Cancelled: no predictions, so the pot is refunded
  Paid: ["Disputed"],
  Cancelled: ["Refunded"],
  Refunded: [],
  Disputed: ["Settling", "Paid", "Refunded"],
};

export function canTransition(from: PotStatus, to: PotStatus): boolean {
  return allowedTransitions[from].includes(to);
}

const minutesBefore = (kickoff: Date, minutes: number) => new Date(kickoff.getTime() - minutes * 60_000);

export const predictionLockTime = (kickoff: Date) => minutesBefore(kickoff, PREDICTION_LOCK_MINUTES_BEFORE_KICKOFF);
export const cancelCutoffTime = (kickoff: Date) => minutesBefore(kickoff, CANCEL_CUTOFF_MINUTES_BEFORE_KICKOFF);

export const isPredictionLocked = (kickoff: Date, now: Date) => now >= predictionLockTime(kickoff);
export const canPotterCancel = (kickoff: Date, now: Date) => now < cancelCutoffTime(kickoff);

/** Pots only accept funding/creation while predictions can still be placed. */
export const isMatchBookable = (status: MatchStatus, kickoff: Date, now: Date) =>
  status === "scheduled" && !isPredictionLocked(kickoff, now);

export interface PotMatchSnapshot {
  kickoffTimeUtc: Date;
  status: MatchStatus;
  isFinalResultOfficial: boolean;
}

export interface AutomaticTransition {
  to: PotStatus;
  reason: string;
}

const liveMatchStatuses: readonly MatchStatus[] = ["first half", "half time", "second half", "full time"];
const refundableStatuses: readonly PotStatus[] = ["Funded", "Open", "Locked", "Live"];

/**
 * Next automatic transition for a pot given its match, or null when none
 * applies. Callers loop until null so a missed cron run catches up fully.
 */
export function nextAutomaticTransition(
  status: PotStatus,
  match: PotMatchSnapshot,
  now: Date,
): AutomaticTransition | null {
  const { kickoffTimeUtc: kickoff } = match;

  if ((match.status === "postponed" || match.status === "abandoned") && (status === "Draft" || refundableStatuses.includes(status))) {
    return { to: "Cancelled", reason: match.status };
  }

  switch (status) {
    case "Draft":
      return isPredictionLocked(kickoff, now) ? { to: "Cancelled", reason: "cancelled" } : null;
    case "Funded":
      return { to: "Open", reason: "funding confirmed" };
    case "Open":
      return isPredictionLocked(kickoff, now) ? { to: "Locked", reason: "prediction lock reached" } : null;
    case "Locked":
      return now >= kickoff || liveMatchStatuses.includes(match.status) ? { to: "Live", reason: "match started" } : null;
    case "Live":
      return match.isFinalResultOfficial ? { to: "Settling", reason: "official final result" } : null;
    default:
      return null;
  }
}
