// Cache freshness policy (T4.8/T4.9) for persisted sports events. This is
// deliberately provider-agnostic: it only reasons about match status and how
// recently a row was refreshed, using the ingestion job cadences as the
// tolerance window before data is considered stale.

import { liveMatchStatuses, type MatchStatus } from "./sports-provider.js";

export type CacheFreshness = "live" | "cached" | "stale";

export interface FreshnessPolicy {
  /** Tolerance before a "live" match's data counts as stale. Live refresh job runs every 10 minutes. */
  liveRefreshToleranceMs: number;
  /** Tolerance before a non-live match's data counts as stale. Fixture prefetch job runs every 4 hours. */
  fixtureRefreshToleranceMs: number;
}

export const defaultFreshnessPolicy: FreshnessPolicy = {
  liveRefreshToleranceMs: 20 * 60 * 1000,
  fixtureRefreshToleranceMs: 8 * 60 * 60 * 1000,
};

/** A finished/abandoned result is terminal and never goes stale once recorded. */
function isTerminalStatus(status: MatchStatus): boolean {
  return status === "full time" || status === "finished" || status === "abandoned";
}

function isLiveStatus(status: MatchStatus): boolean {
  return liveMatchStatuses.includes(status);
}

export function computeFreshness(
  status: MatchStatus,
  lastRefreshedAtIso: string,
  now: Date = new Date(),
  policy: FreshnessPolicy = defaultFreshnessPolicy,
): CacheFreshness {
  if (isTerminalStatus(status)) {
    return "cached";
  }

  const ageMs = now.getTime() - new Date(lastRefreshedAtIso).getTime();
  const tolerance = isLiveStatus(status) ? policy.liveRefreshToleranceMs : policy.fixtureRefreshToleranceMs;

  if (ageMs > tolerance) {
    return "stale";
  }

  return isLiveStatus(status) ? "live" : "cached";
}
