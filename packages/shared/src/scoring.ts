// Pure prediction scoring and ranking. Scores are over 90 minutes of
// regulation time only; callers pass the regulation scoreline. No I/O.

export interface ScoreLine {
  home: number;
  away: number;
}

export interface PredictionPick extends ScoreLine {
  firstGoalMinute?: number | null;
}

/** What actually happened. Optional fields feed the optional tie-break modules. */
export interface MatchOutcome extends ScoreLine {
  firstGoalMinute?: number | null;
  /** Pre-match underdog, when a data source provides one. */
  underdog?: "home" | "away" | null;
}

export interface ScoringRules {
  outcome: number;
  exactScoreline: number;
  goalDifference: number;
  /** Awarded once for each team whose goal count is predicted exactly. */
  teamGoals: number;
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  outcome: 3,
  exactScoreline: 5,
  goalDifference: 2,
  teamGoals: 1,
};

export interface ScoreBreakdown {
  outcome: number;
  exactScoreline: number;
  goalDifference: number;
  homeGoals: number;
  awayGoals: number;
  total: number;
}

const sign = (line: ScoreLine) => Math.sign(line.home - line.away);

export function scorePrediction(
  pick: ScoreLine,
  actual: ScoreLine,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): ScoreBreakdown {
  const points = (hit: boolean, value: number) => (hit ? value : 0);
  const b = {
    outcome: points(sign(pick) === sign(actual), rules.outcome),
    exactScoreline: points(pick.home === actual.home && pick.away === actual.away, rules.exactScoreline),
    goalDifference: points(pick.home - pick.away === actual.home - actual.away, rules.goalDifference),
    homeGoals: points(pick.home === actual.home, rules.teamGoals),
    awayGoals: points(pick.away === actual.away, rules.teamGoals),
  };
  return { ...b, total: b.outcome + b.exactScoreline + b.goalDifference + b.homeGoals + b.awayGoals };
}

/** Tie-break modules return a number where higher is better; they never change points. */
export type TieBreakModule = (pick: PredictionPick, actual: MatchOutcome) => number;

/** Closer to the real first-goal minute ranks higher. Predictions without a minute rank last. */
export const firstGoalProximity: TieBreakModule = (pick, actual) =>
  pick.firstGoalMinute == null || actual.firstGoalMinute == null
    ? Number.NEGATIVE_INFINITY
    : -Math.abs(pick.firstGoalMinute - actual.firstGoalMinute);

/** 1 when the pick correctly backed the underdog to win, otherwise 0. */
export const underdogBonus: TieBreakModule = (pick, actual) => {
  if (!actual.underdog) return 0;
  const side = actual.underdog === "home" ? 1 : -1;
  return sign(actual) === side && sign(pick) === side ? 1 : 0;
};

export const tieBreakModules = { firstGoalProximity, underdogBonus } as const;
export type TieBreakName = keyof typeof tieBreakModules;
/** Underdog first: it is binary and rare, so it would never matter after the near-continuous minute comparison. */
export const DEFAULT_TIE_BREAKS: readonly TieBreakName[] = ["underdogBonus", "firstGoalProximity"];

export interface LeaderboardInput<T> {
  item: T;
  pick: PredictionPick;
}

export type RankedEntry<T> = {
  rank: number;
  item: T;
  breakdown: ScoreBreakdown;
  tieBreaks: number[];
};

/**
 * Ranks by total points, then by the enabled tie-break modules in order.
 * Entries still level afterwards share a rank (1, 1, 3 ...) so payout can
 * merge and split the affected prize slots equally.
 */
export function rankPredictions<T>(
  entries: LeaderboardInput<T>[],
  actual: MatchOutcome,
  options: { rules?: ScoringRules; tieBreaks?: readonly TieBreakName[] } = {},
): RankedEntry<T>[] {
  const modules = (options.tieBreaks ?? []).map((name) => tieBreakModules[name]);
  const scored = entries.map(({ item, pick }) => ({
    item,
    breakdown: scorePrediction(pick, actual, options.rules),
    tieBreaks: modules.map((module) => module(pick, actual)),
  }));

  const compare = (a: (typeof scored)[number], b: (typeof scored)[number]) => {
    if (a.breakdown.total !== b.breakdown.total) return b.breakdown.total - a.breakdown.total;
    for (let i = 0; i < a.tieBreaks.length; i++) {
      if (a.tieBreaks[i] !== b.tieBreaks[i]) return a.tieBreaks[i] > b.tieBreaks[i] ? -1 : 1;
    }
    return 0;
  };

  scored.sort(compare);
  let rank = 0;
  return scored.map((entry, index) => {
    if (index === 0 || compare(scored[index - 1], entry) !== 0) rank = index + 1;
    return { rank, ...entry };
  });
}

export const MAX_PREDICTED_GOALS = 20;
export const MAX_FIRST_GOAL_MINUTE = 90;
