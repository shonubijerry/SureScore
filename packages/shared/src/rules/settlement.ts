// Pure settlement rules: which results may settle a pot and how the prize is
// divided. Amounts are integer minor units and always sum exactly to the
// winner pool. No I/O.

import type { MatchOutcome } from "./scoring.js";

export const PLATFORM_FEE_PERCENT = 10;
export const WINNER_POOL_PERCENT = 90;

/** Share of the winner pool per rank, keyed by the number of paid winners. */
export const DEFAULT_PRIZE_SPLITS: Record<number, readonly number[]> = {
  1: [100],
  2: [60, 40],
  3: [50, 30, 20],
};

export interface SettlementMatch {
  status: string;
  isFinalResultOfficial: boolean;
  homeScore: number | null;
  awayScore: number | null;
  firstGoalMinute?: number | null;
  underdog?: string | null;
}

/**
 * The regulation-time (90 min + stoppage) outcome a pot may settle on, or null
 * while it is not final. Only a "full time" status counts: extra time and
 * penalty phases never produce a settleable result.
 */
export function regulationOutcome(match: SettlementMatch): MatchOutcome | null {
  if (match.status !== "full time" || !match.isFinalResultOfficial) return null;
  if (match.homeScore == null || match.awayScore == null) return null;
  return {
    home: match.homeScore,
    away: match.awayScore,
    firstGoalMinute: match.firstGoalMinute,
    underdog: match.underdog as MatchOutcome["underdog"],
  };
}

export function splitPrizePool(prizeMinorUnits: number) {
  const winnerPool = Math.floor((prizeMinorUnits * WINNER_POOL_PERCENT) / 100);
  return { winnerPool, platformFee: prizeMinorUnits - winnerPool };
}

/** Per-rank amounts for `count` winners; any rounding remainder goes to rank 1. */
function slotAmounts(winnerPool: number, count: number): number[] {
  const amounts = DEFAULT_PRIZE_SPLITS[count].map((percent) => Math.floor((winnerPool * percent) / 100));
  amounts[0] += winnerPool - amounts.reduce((sum, amount) => sum + amount, 0);
  return amounts;
}

/**
 * Pays `ranked` (best first, equal rank = tied) from the winner pool. Tied
 * users merge the prize slots they cover and split them equally; leftover
 * minor units go to the earliest tied entries. With fewer players than
 * winner slots, the split for the actual player count is used so the whole
 * pool is always paid out.
 */
export function distributePrizes<T extends { rank: number }>(
  ranked: readonly T[],
  winnerCount: number,
  prizeMinorUnits: number,
): { entry: T; amountMinorUnits: number }[] {
  const paidSlots = Math.min(winnerCount, ranked.length, 3);
  if (paidSlots < 1) return [];
  const slots = slotAmounts(splitPrizePool(prizeMinorUnits).winnerPool, paidSlots);

  const payouts: { entry: T; amountMinorUnits: number }[] = [];
  for (let start = 0; start < paidSlots; ) {
    const tied = ranked.filter((entry) => entry.rank === ranked[start].rank);
    const merged = slots.slice(start, start + tied.length).reduce((sum, amount) => sum + amount, 0);
    const share = Math.floor(merged / tied.length);
    const remainder = merged - share * tied.length;
    tied.forEach((entry, index) => {
      const amountMinorUnits = share + (index < remainder ? 1 : 0);
      if (amountMinorUnits > 0) payouts.push({ entry, amountMinorUnits });
    });
    start += tied.length;
  }
  return payouts;
}
