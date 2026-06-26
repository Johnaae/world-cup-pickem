import { fetchTheOddsApiMatches, fetchTheOddsApiRemaining } from "./providers/theoddsapi";
import {
  syncNormalizedMatches,
  markStaleApiOptions,
  suspendAllMatchMarkets,
  closeAllMatchMarkets,
  reopenAllMatchMarkets,
  type SyncMode,
  type SyncOptions,
} from "./syncMarkets";
import type { NormalizedMatch, SyncResult } from "./types";
import { OddsProviderError } from "./types";

export * from "./types";
export * from "./utils";
export * from "./staleness";
export { syncNormalizedMatches, markStaleApiOptions, suspendAllMatchMarkets, closeAllMatchMarkets, reopenAllMatchMarkets } from "./syncMarkets";
export type { SyncMode, SyncOptions } from "./syncMarkets";
export { parseBulkMarketText, BULK_PASTE_EXAMPLE } from "./bulkPaste";
export { applyBulkMarketPaste } from "./applyBulkPaste";
export { fetchTheOddsApiEvents, fetchTheOddsApiRemaining } from "./providers/theoddsapi";

export async function fetchMatchesFromProvider(): Promise<{
  provider: "THEODDSAPI";
  matches: NormalizedMatch[];
}> {
  const matches = await fetchTheOddsApiMatches();
  return { provider: "THEODDSAPI", matches };
}

export async function syncMarkets(
  options: SyncOptions = {}
): Promise<SyncResult & { requestsRemaining?: number | null }> {
  const { matches } = await fetchMatchesFromProvider();
  const result = await syncNormalizedMatches(matches, "THEODDSAPI", options);
  const requestsRemaining = await fetchTheOddsApiRemaining();
  return { ...result, requestsRemaining };
}

export async function syncAllMarkets(): Promise<
  SyncResult & { requestsRemaining?: number | null }
> {
  return syncMarkets({ mode: "all" });
}

export async function syncMatchesOnly(): Promise<
  SyncResult & { requestsRemaining?: number | null }
> {
  return syncMarkets({ mode: "matches" });
}

export async function syncOddsOnly(): Promise<
  SyncResult & { requestsRemaining?: number | null }
> {
  return syncMarkets({ mode: "odds" });
}

export async function syncMatchOdds(
  matchId: string,
  overwriteManual = false
): Promise<SyncResult & { requestsRemaining?: number | null }> {
  return syncMarkets({ mode: "odds", matchId, overwriteManual });
}

export { OddsProviderError as OddsApiError };
