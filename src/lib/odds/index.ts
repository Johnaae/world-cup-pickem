import { fetchTheOddsApiMatches, fetchTheOddsApiRemaining } from "./providers/theoddsapi";
import { syncNormalizedMatches } from "./syncMarkets";
import type { NormalizedMatch, SyncResult } from "./types";
import { OddsProviderError } from "./types";

export * from "./types";
export * from "./utils";
export { syncNormalizedMatches } from "./syncMarkets";
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

export async function syncAllMarkets(): Promise<
  SyncResult & { requestsRemaining?: number | null }
> {
  const { matches } = await fetchMatchesFromProvider();
  const result = await syncNormalizedMatches(matches, "THEODDSAPI");
  const requestsRemaining = await fetchTheOddsApiRemaining();
  return { ...result, requestsRemaining };
}

export { OddsProviderError as OddsApiError };
