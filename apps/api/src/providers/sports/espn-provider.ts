// ESPN soccer scoreboard adapter. All ESPN-specific response shapes and
// endpoints are isolated here; nothing outside this file may know that
// "ESPN" exists. Only the internal `SportsProvider` contract and the
// normalized `SportsEvent` schema are exposed.
//
// Endpoint pattern: http://site.api.espn.com/apis/site/v2/sports/soccer/:league/scoreboard

import { getSportsProviderConfig } from "@surescore/shared";
import type { FinalResult, FixturesQuery, MatchStatus, SportsEvent, SportsProvider } from "@surescore/shared";

export interface EspnSportsProviderConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { displayName: string };
  score?: string;
}

interface EspnStatusType {
  name: string; // e.g. STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL, STATUS_POSTPONED, STATUS_CANCELED
  completed: boolean;
}

interface EspnCompetition {
  id: string;
  date: string;
  status: { type: EspnStatusType };
  competitors: EspnCompetitor[];
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

function toInternalStatus(espnStatusName: string): MatchStatus {
  switch (espnStatusName) {
    case "STATUS_IN_PROGRESS":
    case "STATUS_HALFTIME":
      return "live";
    case "STATUS_FINAL":
      return "finished";
    case "STATUS_POSTPONED":
      return "postponed";
    case "STATUS_CANCELED":
    case "STATUS_ABANDONED":
      return "abandoned";
    default:
      return "scheduled";
  }
}

function toScore(value: string | undefined): number | null {
  if (value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(league: string, event: EspnEvent): SportsEvent {
  const competition = event.competitions[0];
  const home = competition?.competitors.find((competitor) => competitor.homeAway === "home");
  const away = competition?.competitors.find((competitor) => competitor.homeAway === "away");
  const status = toInternalStatus(competition?.status.type.name ?? "");

  return {
    id: event.id,
    provider: "espn",
    league,
    homeTeam: home?.team.displayName ?? "Unknown",
    awayTeam: away?.team.displayName ?? "Unknown",
    kickoffTimeUtc: event.date,
    status,
    homeScore: toScore(home?.score),
    awayScore: toScore(away?.score),
    // ESPN's default competitor score reflects 90 minutes + stoppage time for
    // soccer; extra time/penalty shootout outcomes are reported separately
    // and are never folded into this field, so "finished" here is always the
    // regulation-time result.
    isFinalResultOfficial: status === "finished",
    lastUpdatedUtc: new Date().toISOString(),
  };
}

export class EspnSportsProvider implements SportsProvider {
  readonly id = "espn";

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EspnSportsProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? "http://site.api.espn.com/apis/site/v2/sports/soccer";
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async fetchScoreboard(league: string): Promise<SportsEvent[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/${league}/scoreboard`);
    if (!response.ok) {
      throw new Error(`ESPN scoreboard request for league "${league}" failed: ${response.statusText}`);
    }
    const body = (await response.json()) as EspnScoreboardResponse;
    return body.events.map((event) => normalizeEvent(league, event));
  }

  async getFixtures(league: string, _query?: FixturesQuery): Promise<SportsEvent[]> {
    const events = await this.fetchScoreboard(league);
    return events.filter((event) => event.status === "scheduled");
  }

  async getLiveScores(league: string): Promise<SportsEvent[]> {
    const events = await this.fetchScoreboard(league);
    return events.filter((event) => event.status === "live");
  }

  async getKickoffTime(eventId: string): Promise<string> {
    const event = await this.findEvent(eventId);
    return event.kickoffTimeUtc;
  }

  async getStatus(eventId: string): Promise<MatchStatus> {
    const event = await this.findEvent(eventId);
    return event.status;
  }

  async getFinalResult(eventId: string): Promise<FinalResult> {
    const event = await this.findEvent(eventId);
    return {
      status: event.status,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      isFinalResultOfficial: event.isFinalResultOfficial,
    };
  }

  /** ESPN's scoreboard is not queryable by event id directly, so we scan the configured leagues. */
  private async findEvent(eventId: string): Promise<SportsEvent> {
    const leagues = getSportsProviderConfig(this.id)?.leagues ?? [];
    for (const league of leagues) {
      const events = await this.fetchScoreboard(league);
      const match = events.find((event) => event.id === eventId);
      if (match) {
        return match;
      }
    }
    throw new Error(`No ESPN event found for id "${eventId}"`);
  }
}
