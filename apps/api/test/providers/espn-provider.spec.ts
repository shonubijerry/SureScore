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

  it("normalizes ESPN scoreboard events into the internal SportsEvent schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(scoreboardResponse([scheduledEvent]));
    const provider = new EspnSportsProvider({ fetchImpl });

    const fixtures = await provider.getFixtures("eng.1");

    expect(fixtures).toHaveLength(1);
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
});
