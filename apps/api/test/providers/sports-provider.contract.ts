// Contract assertions for any `SportsProvider` adapter (T3.6). Adapter specs
// should run their concrete instance through these assertions instead of
// re-asserting shape by hand, so all adapters are held to the same internal
// contract regardless of the underlying provider.

import { expect } from "vitest";
import type { SportsEvent, SportsProvider } from "@surescore/shared";

const sportsMethods = ["getFixtures", "getLiveScores", "getKickoffTime", "getStatus", "getFinalResult"] as const;

export function assertImplementsSportsProviderContract(provider: SportsProvider): void {
  expect(typeof provider.id).toBe("string");
  expect(provider.id.length).toBeGreaterThan(0);
  for (const method of sportsMethods) {
    expect(typeof provider[method]).toBe("function");
  }
}

export function assertSportsEventShape(event: SportsEvent): void {
  expect(typeof event.id).toBe("string");
  expect(typeof event.provider).toBe("string");
  expect(typeof event.league).toBe("string");
  expect(typeof event.homeTeam).toBe("string");
  expect(typeof event.awayTeam).toBe("string");
  expect(() => new Date(event.kickoffTimeUtc).toISOString()).not.toThrow();
  expect(["scheduled", "live", "finished", "postponed", "abandoned"]).toContain(event.status);
  expect(event.homeScore === null || typeof event.homeScore === "number").toBe(true);
  expect(event.awayScore === null || typeof event.awayScore === "number").toBe(true);
  expect(typeof event.isFinalResultOfficial).toBe("boolean");
}
