// Sports data ingestion (T4.3/T4.4/T4.6/T4.9). Depends only on the internal
// `SportsProvider` contract and the store-agnostic `SportsEventCacheStore`,
// so a provider outage never reaches core logic as anything other than a
// "keep serving the last cached data" outcome.

import { log } from "./logger.js"
import { computeFreshness, getSportsProviderConfig, type FixturesQuery, type SportsProvider } from "@surescore/shared";
import type { SportsEventCacheRecord, SportsEventCacheStore } from "./sports-cache-repository.js";

export interface IngestionFailure {
  league?: string;
  error: string;
}

export interface IngestionResult {
  refreshedEvents: number;
  failures: IngestionFailure[];
}

function leaguesFor(provider: SportsProvider): string[] {
  return getSportsProviderConfig(provider.id)?.leagues ?? [];
}

/** T4.2: league mapping comes from shared sports provider config, never hardcoded per adapter call site. */
async function forEachLeague(
  provider: SportsProvider,
  fetchLeague: (league: string) => Promise<SportsEventCacheRecord[]>,
  store: SportsEventCacheStore,
): Promise<IngestionResult> {
  let refreshedEvents = 0;
  const failures: IngestionFailure[] = [];

  for (const league of leaguesFor(provider)) {
    try {
      const records = await fetchLeague(league);
      await store.upsertMany(records);
      refreshedEvents += records.length;
    } catch (error) {
			log.error("sync", "league_failed", { league, error });
      // Fallback (T4.6): a failed league fetch leaves previously cached rows
      // untouched; readers fall back to that cached data (flagged stale by
      // computeFreshness once it ages out) instead of the job crashing.
      failures.push({ league, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { refreshedEvents, failures };
}

/** Scheduled every 4 hours: prefetch upcoming fixtures per T4.1/T4.3. */
export async function prefetchFixtures(
  provider: SportsProvider,
  store: SportsEventCacheStore,
  query?: FixturesQuery,
): Promise<IngestionResult> {
  const now = new Date();
  try {
    const events = await provider.getFixtures(query);
    const records = events.map((event) => ({
      ...event,
      freshness: computeFreshness(event.status, now.toISOString(), now),
      lastRefreshedAt: now.toISOString(),
    }));
    await store.upsertMany(records);
    return { refreshedEvents: records.length, failures: [] };
  } catch (error) {
    return {
      refreshedEvents: 0,
      failures: [{ error: error instanceof Error ? error.message : String(error) }],
    };
  }
}

/** Scheduled every 10 minutes: refresh in-play scores per T4.1/T4.4. */
export async function refreshLiveScores(provider: SportsProvider, store: SportsEventCacheStore): Promise<IngestionResult> {
  const now = new Date();
  return forEachLeague(
    provider,
    async (league) => {
      const events = await provider.getLiveScores(league);
      return events.map((event) => ({
        ...event,
        freshness: computeFreshness(event.status, now.toISOString(), now),
        lastRefreshedAt: now.toISOString(),
      }));
    },
    store,
  );
}

/** T4.9: recompute and persist freshness for every cached row so stale data is never mistaken for fresh. */
export async function invalidateStaleEvents(store: SportsEventCacheStore, now: Date = new Date()): Promise<number> {
  const rows = await store.listAll();
  let invalidatedCount = 0;

  for (const row of rows) {
    const freshness = computeFreshness(row.status, row.lastRefreshedAt, now);
    if (freshness !== row.freshness) {
      await store.updateFreshness(`${row.provider}:${row.id}`, freshness);
      invalidatedCount += 1;
    }
  }

  return invalidatedCount;
}
