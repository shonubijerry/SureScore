// Internal sports data provider contract (T3.2) and the normalized event
// schema (T3.3). Core domain/business logic must only ever depend on these
// types; provider-specific response shapes (ESPN scoreboard JSON, etc.) must
// stay inside the adapter that implements this interface.

export const matchStatuses = ["scheduled", "first half", "half time", "second half", "full time", "postponed", "abandoned"] as const;
export type MatchStatus = (typeof matchStatuses)[number];

/** Statuses during which the match is in play and scores refresh every 10 minutes. */
export const liveMatchStatuses: readonly MatchStatus[] = ["first half", "half time", "second half"];

/**
 * Normalized internal sports event. Scores always reflect 90 minutes of
 * regulation time plus stoppage time only — extra time and penalty
 * shootouts are never reflected here or in any settlement decision.
 */
export interface SportsEvent {
  id: string;
  provider: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTimeUtc: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  /** True once the regulation-time result is official and safe to settle on. */
  isFinalResultOfficial: boolean;
  /** Minute of the first regulation-time goal; null until a goal is scored. */
  firstGoalMinute?: number | null;
  /** Pre-match underdog derived from the moneyline; null when odds are unavailable or level. */
  underdog?: "home" | "away" | null;
  lastUpdatedUtc: string;
}

export interface FinalResult {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  isFinalResultOfficial: boolean;
}

export interface FixturesQuery {
  from?: string;
  to?: string;
}

export interface SportsProvider {
  readonly id: string;
  getFixtures(query?: FixturesQuery): Promise<SportsEvent[]>;
  getLiveScores(league: string): Promise<SportsEvent[]>;
  getKickoffTime(eventId: string): Promise<string>;
  getStatus(eventId: string): Promise<MatchStatus>;
  getFinalResult(eventId: string): Promise<FinalResult>;
}
