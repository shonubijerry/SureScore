import { describe, expect, it, vi } from "vitest";
import { EspnSportsProvider } from "../../src/providers/sports/espn-provider.js";
import { assertImplementsSportsProviderContract, assertSportsEventShape } from "./sports-provider.contract.js";

function scoreboardResponse(events: unknown[]): Response {
  return new Response(JSON.stringify({ events }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const finishedEvent = {
  id: "evt_1",
  date: "2026-09-20T15:00:00Z",
  competitions: [
    {
      id: "evt_1",
      date: "2026-09-20T15:00:00Z",
      status: { type: { name: "STATUS_FINAL", completed: true } },
      competitors: [
        { homeAway: "home", team: { displayName: "Arsenal" }, score: "2" },
        { homeAway: "away", team: { displayName: "Chelsea" }, score: "1" },
      ],
    },
  ],
};

const scheduledEvent = {
  id: "evt_2",
  date: "2026-09-27T15:00:00Z",
  competitions: [
    {
      id: "evt_2",
      date: "2026-09-27T15:00:00Z",
      status: { type: { name: "STATUS_SCHEDULED", completed: false } },
      competitors: [
        { homeAway: "home", team: { displayName: "Liverpool" } },
        { homeAway: "away", team: { displayName: "Everton" } },
      ],
    },
  ],
};

describe("EspnSportsProvider", () => {
  it("satisfies the internal SportsProvider contract", () => {
    const provider = new EspnSportsProvider({ fetchImpl: vi.fn() });
    assertImplementsSportsProviderContract(provider);
  });

  it("requests future schedule dates and normalizes events into the internal SportsEvent schema", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(scoreboardResponse([scheduledEvent]))
      .mockResolvedValueOnce(scoreboardResponse([]));
    const provider = new EspnSportsProvider({ fetchImpl });

    const fixtures = await provider.getFixtures({
      from: "2026-09-27T00:00:00Z",
      to: "2026-09-28T23:59:59Z",
    });

    expect(fixtures).toHaveLength(1);
    expect(fetchImpl.mock.calls).toEqual([
      ["https://site.web.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260927"],
      ["https://site.web.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260928"],
    ]);
    assertSportsEventShape(fixtures[0]);
    expect(fixtures[0]).toMatchObject({
      id: "evt_2",
      provider: "espn",
      league: "eng.1",
      homeTeam: "Liverpool",
      awayTeam: "Everton",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      isFinalResultOfficial: false,
    });
  });

  it("getFinalResult() only reports the regulation-time score as official", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(scoreboardResponse([finishedEvent]));
    const provider = new EspnSportsProvider({ fetchImpl });

    const result = await provider.getFinalResult("evt_1");

    expect(result).toStrictEqual({
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      isFinalResultOfficial: true,
    });
  });

  it("getLiveScores() excludes scheduled and finished events", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(scoreboardResponse([scheduledEvent, finishedEvent]));
    const provider = new EspnSportsProvider({ fetchImpl });

    const live = await provider.getLiveScores("eng.1");

    expect(live).toHaveLength(0);
  });

  it("derives the first regulation goal minute and the moneyline underdog", async () => {
    const event = structuredClone(scheduledEvent) as any;
    event.competitions[0].details = [
      { scoringPlay: false, clock: { value: 60 } },
      { scoringPlay: true, clock: { value: 2700 } },
      { scoringPlay: true, clock: { value: 1018 } },
      { scoringPlay: true, shootout: true, clock: { value: 10 } },
      { scoringPlay: true, clock: { value: 6000 } },
    ];
    event.competitions[0].odds = [{ moneyline: { home: { close: { odds: "+215" } }, away: { close: { odds: "-130" } } } }];
    const provider = new EspnSportsProvider({ fetchImpl: vi.fn().mockImplementation(async () => scoreboardResponse([event])) });

    const [normalized] = await provider.getFixtures({ from: "2026-09-27", to: "2026-09-27" });
    expect(normalized).toMatchObject({ firstGoalMinute: 17, underdog: "home" });
  });

  it("leaves tie-break inputs null when ESPN has no goals or odds", async () => {
    const provider = new EspnSportsProvider({ fetchImpl: vi.fn().mockImplementation(async () => scoreboardResponse([scheduledEvent])) });
    const [normalized] = await provider.getFixtures({ from: "2026-09-27", to: "2026-09-27" });
    expect(normalized).toMatchObject({ firstGoalMinute: null, underdog: null });
  });
});
