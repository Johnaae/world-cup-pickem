import { MatchStatus, OddsProvider, type MarketOption, type Match } from "@prisma/client";

export const STALE_LIVE_SECONDS = 60;
export const STALE_UPCOMING_SECONDS = 5 * 60;

export function isApiSourcedProvider(provider: OddsProvider): boolean {
  return provider === OddsProvider.THEODDSAPI || provider === OddsProvider.SPORTSGAMEODDS;
}

export function getOptionSyncTime(option: Pick<MarketOption, "lastSyncedAt" | "sourceSyncedAt">): Date | null {
  return option.lastSyncedAt ?? option.sourceSyncedAt;
}

export function isOptionStale(
  option: Pick<MarketOption, "lastSyncedAt" | "sourceSyncedAt" | "provider" | "isStale">,
  matchStatus: MatchStatus
): boolean {
  if (!isApiSourcedProvider(option.provider)) return false;

  const syncedAt = getOptionSyncTime(option);
  if (!syncedAt) return true;

  const ageMs = Date.now() - syncedAt.getTime();
  const maxAgeMs =
    matchStatus === MatchStatus.LIVE ? STALE_LIVE_SECONDS * 1000 : STALE_UPCOMING_SECONDS * 1000;

  return ageMs > maxAgeMs;
}

export function staleErrorKey(matchStatus: MatchStatus): "ODDS_STALE_LIVE" | "ODDS_STALE_UPCOMING" {
  return matchStatus === MatchStatus.LIVE ? "ODDS_STALE_LIVE" : "ODDS_STALE_UPCOMING";
}

export function assertOptionFreshForPick(
  option: MarketOption,
  match: Pick<Match, "status">
): void {
  if (option.status !== "ACTIVE") {
    throw new Error("OPTION_NOT_ACTIVE");
  }

  if (!isApiSourcedProvider(option.provider)) return;

  if (isOptionStale(option, match.status)) {
    throw new Error(staleErrorKey(match.status));
  }
}

export function getMatchLastSyncedAt(
  options: Pick<MarketOption, "lastSyncedAt" | "sourceSyncedAt" | "provider">[]
): Date | null {
  let latest: Date | null = null;
  for (const opt of options) {
    if (!isApiSourcedProvider(opt.provider)) continue;
    const t = getOptionSyncTime(opt);
    if (t && (!latest || t > latest)) latest = t;
  }
  return latest;
}

export function matchHasStaleApiOptions(
  options: Pick<MarketOption, "lastSyncedAt" | "sourceSyncedAt" | "provider" | "isStale" | "status">[],
  matchStatus: MatchStatus
): boolean {
  return options.some(
    (o) => o.status === "ACTIVE" && isApiSourcedProvider(o.provider) && isOptionStale(o, matchStatus)
  );
}
