"use client";

import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick, MatchStatus } from "@prisma/client";
import type { MarketType } from "@/lib/markets";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";

type MatchCardProps = {
  match: Match & {
    markets?: (Market & { options: MarketOption[] })[];
    picks?: (Pick & { market?: Market | null; marketOption?: MarketOption | null })[];
  };
  onPick?: () => void;
  showPickButton?: boolean;
};

const statusStyles: Record<MatchStatus, string> = {
  UPCOMING: "badge-pending",
  LIVE: "badge-live",
  FINISHED: "badge-finished",
};

export function MatchCard({ match, onPick, showPickButton = true }: MatchCardProps) {
  const { t, locale, fmt } = useI18n();
  const picks = match.picks ?? [];
  const locked = match.status !== "UPCOMING" || new Date(match.startTime) <= new Date();
  const marketCount = match.markets?.length ?? 0;
  const dateLocale = getDateFnsLocale(locale);

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
          {match.status === "FINISHED" && match.scoreA !== null && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreA}</p>
          )}
        </div>
        <div className="text-slate-500 font-bold">{t.matches.vs}</div>
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-white">{match.teamB}</p>
          {match.status === "FINISHED" && match.scoreB !== null && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreB}</p>
          )}
        </div>
      </div>

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

      {showPickButton && onPick && (
        <button
          onClick={onPick}
          className={`mt-4 w-full ${locked && picks.length === 0 ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}
          disabled={locked && picks.length === 0}
        >
          {picks.length > 0
            ? locked
              ? t.matches.picksLocked
              : t.matches.makeEditPicks
            : locked
              ? t.matches.locked
              : t.matches.makePick}
        </button>
      )}
    </div>
  );
}
