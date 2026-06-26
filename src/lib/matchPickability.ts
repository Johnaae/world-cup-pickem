import { MatchStatus, type MarketOption, type Match, type Market } from "@prisma/client";
import {
  isApiSourcedProvider,
  isOptionStale,
  getMatchLastSyncedAt,
} from "./odds/staleness";

export type MatchWithMarkets = Pick<Match, "status" | "startTime"> & {
  markets?: (Pick<Market, "id"> & { options: MarketOption[] })[];
};

export type MatchPickButtonState =
  | "finished"
  | "locked"
  | "pick"
  | "pickLive"
  | "refreshOdds";

export function isMatchFinished(match: Pick<Match, "status">): boolean {
  return match.status === MatchStatus.FINISHED;
}

/** True when the match cannot accept any picks at all. */
export function isMatchClosedForPicking(match: Pick<Match, "status" | "startTime">): boolean {
  if (match.status === MatchStatus.FINISHED) return true;
  if (match.status === MatchStatus.LIVE) return false;
  if (match.status === MatchStatus.UPCOMING) {
    return new Date() >= new Date(match.startTime);
  }
  return true;
}

export function canShowPickForm(match: Pick<Match, "status" | "startTime">): boolean {
  return !isMatchClosedForPicking(match) && !isMatchFinished(match);
}

export function assertMatchAllowsPicks(match: Pick<Match, "status" | "startTime">): void {
  if (match.status === MatchStatus.FINISHED) throw new Error("MATCH_FINISHED");
  if (match.status === MatchStatus.LIVE) return;
  if (match.status === MatchStatus.UPCOMING && new Date() < new Date(match.startTime)) return;
  throw new Error("MATCH_LOCKED");
}

function allOptions(match: MatchWithMarkets): MarketOption[] {
  return (match.markets ?? []).flatMap((m) => m.options);
}

export function hasActiveOptions(match: MatchWithMarkets): boolean {
  return allOptions(match).some((o) => o.status === "ACTIVE");
}

export function hasPickableOptions(match: MatchWithMarkets): boolean {
  return allOptions(match).some((o) => isOptionPickable(o, match.status));
}

export function isOptionPickable(
  option: Pick<MarketOption, "status" | "provider" | "lastSyncedAt" | "sourceSyncedAt" | "isStale">,
  matchStatus: MatchStatus
): boolean {
  if (option.status !== "ACTIVE") return false;
  if (!isApiSourcedProvider(option.provider)) return true;
  return !isOptionStale(option, matchStatus);
}

export function getMatchPickButtonState(match: MatchWithMarkets): MatchPickButtonState {
  if (match.status === MatchStatus.FINISHED) return "finished";

  const options = allOptions(match);
  const active = options.filter((o) => o.status === "ACTIVE");

  if (active.length === 0) return "locked";

  if (match.status === MatchStatus.LIVE) {
    if (active.some((o) => isOptionPickable(o, match.status))) return "pickLive";
    if (active.some((o) => isApiSourcedProvider(o.provider))) return "refreshOdds";
    return "locked";
  }

  if (match.status === MatchStatus.UPCOMING) {
    if (new Date() >= new Date(match.startTime)) return "locked";
    return "pick";
  }

  return "locked";
}

export { getMatchLastSyncedAt };
