"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick, MatchStatus } from "@prisma/client";
import type { MarketType } from "@/lib/markets";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";
import {
  getMatchLastSyncedAt,
  getMatchPickButtonState,
  type MatchWithMarkets,
} from "@/lib/matchPickability";

type RefreshResult = { ok: boolean; error?: string };

type MatchCardProps = {
  match: Match & {
    markets?: (Market & { options: MarketOption[] })[];
    picks?: (Pick & { market?: Market | null; marketOption?: MarketOption | null })[];
  };
  onPick?: () => void;
  onRefreshOdds?: (matchId: string) => Promise<RefreshResult>;
  showPickButton?: boolean;
};

const statusStyles: Record<MatchStatus, string> = {
  UPCOMING: "badge-pending",
  LIVE: "badge-live",
  FINISHED: "badge-finished",
};

export function MatchCard({ match, onPick, onRefreshOdds, showPickButton = true }: MatchCardProps) {
  const { t, locale, fmt } = useI18n();
  const picks = match.picks ?? [];
  const marketCount = match.markets?.length ?? 0;
  const dateLocale = getDateFnsLocale(locale);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const buttonState = getMatchPickButtonState(match as MatchWithMarkets);
  const lastOddsSync = getMatchLastSyncedAt(
    (match.markets ?? []).flatMap((m) => m.options)
  );

  const showLiveScore = match.status === "LIVE" || match.status === "FINISHED";
  const hasScore = match.scoreA !== null && match.scoreB !== null;

  function marketLabel(type: MarketType) {
    return t.markets[type];
  }

  function outcomeLabel(pick: NonNullable<MatchCardProps["match"]["picks"]>[0]) {
    if (pick.marketOption?.label) return pick.marketOption.label;
    if (pick.selectedOutcome === "TEAM_A") return match.teamA;
    if (pick.selectedOutcome === "TEAM_B") return match.teamB;
    if (pick.selectedOutcome === "DRAW") return t.outcomes.draw;
    return t.common.na;
  }

  function buttonLabel(): string {
    if (refreshing) return t.matches.refreshing;
    if (picks.length > 0 && (buttonState === "pick" || buttonState === "pickLive")) {
      return t.matches.makeEditPicks;
    }
    switch (buttonState) {
      case "finished":
        return t.matches.finished;
      case "pick":
        return t.matches.makePick;
      case "pickLive":
        return t.matches.makeLivePick;
      case "refreshOdds":
        return t.matches.refreshOdds;
      case "locked":
      default:
        return t.matches.locked;
    }
  }

  const primaryDisabled =
    refreshing || buttonState === "finished" || buttonState === "locked";

  async function runRefresh(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!onRefreshOdds || refreshing) return;

    setRefreshing(true);
    setRefreshError("");
    try {
      const result = await onRefreshOdds(match.id);
      if (!result.ok) {
        setRefreshError(result.error ?? t.common.failed);
      }
    } catch (err) {
      console.error("[MatchCard] refresh error:", err);
      setRefreshError(err instanceof Error ? err.message : t.common.somethingWrong);
    } finally {
      setRefreshing(false);
    }
  }

  function handlePrimaryClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (refreshing) return;

    if (buttonState === "refreshOdds") {
      void runRefresh(e);
      return;
    }
    if (buttonState === "pick" || buttonState === "pickLive") {
      onPick?.();
    }
  }

  return (
    <div className="card hover:border-slate-600 transition">
      <div className="flex items-center justify-between mb-3">
        <span className={`badge ${statusStyles[match.status]}`}>
          {t.matchStatus[match.status]}
        </span>
        <span className="text-xs text-slate-500">
          {format(new Date(match.startTime), "MMM d · HH:mm", { locale: dateLocale })}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-white">{match.teamA}</p>
          {showLiveScore && hasScore && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreA}</p>
          )}
        </div>
        <div className="text-slate-500 font-bold">{t.matches.vs}</div>
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-white">{match.teamB}</p>
          {showLiveScore && hasScore && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreB}</p>
          )}
        </div>
      </div>

      {showLiveScore && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          {t.matches.score}:{" "}
          {hasScore ? `${match.scoreA} - ${match.scoreB}` : t.matches.scoreUnavailable}
        </p>
      )}

      {match.status === "LIVE" && lastOddsSync && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          {t.matches.oddsLastUpdated}: {format(lastOddsSync, "HH:mm:ss", { locale: dateLocale })}
        </p>
      )}

      {marketCount > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          {fmt(marketCount === 1 ? t.matches.marketAvailable : t.matches.marketsAvailable, {
            count: marketCount,
          })}
        </p>
      )}

      {picks.length > 0 && (
        <div className="mt-4 space-y-2">
          {picks.map((pick) => (
            <div
              key={pick.id}
              className={`rounded-lg p-3 text-sm ${
                pick.status === "WON"
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : pick.status === "LOST"
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-amber-500/10 border border-amber-500/30"
              }`}
            >
              <div className="flex justify-between">
                <span className="text-slate-400">
                  {pick.market ? marketLabel(pick.market.type as MarketType) : t.dashboard.pick}
                </span>
                <span
                  className={`font-semibold ${
                    pick.status === "WON"
                      ? "text-emerald-400"
                      : pick.status === "LOST"
                        ? "text-red-400"
                        : "text-amber-400"
                  }`}
                >
                  {t.pickStatus[pick.status]}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-white">{outcomeLabel(pick)}</span>
                <span className="text-slate-400">
                  {pick.pointsRisked} {t.nav.points} @ x{pick.multiplier}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {refreshError && (
        <p className="mt-3 text-xs text-red-400 text-center">{refreshError}</p>
      )}

      {showPickButton && (onPick || onRefreshOdds) && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handlePrimaryClick}
            className={`flex-1 ${
              primaryDisabled && buttonState !== "refreshOdds"
                ? "btn-secondary opacity-50 cursor-not-allowed"
                : "btn-primary"
            }`}
            disabled={primaryDisabled}
          >
            {buttonLabel()}
          </button>
          {match.status === "LIVE" && onRefreshOdds && buttonState !== "refreshOdds" && (
            <button
              type="button"
              onClick={runRefresh}
              disabled={refreshing}
              className="btn-secondary shrink-0"
            >
              {refreshing ? t.matches.refreshing : t.matches.refresh}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
