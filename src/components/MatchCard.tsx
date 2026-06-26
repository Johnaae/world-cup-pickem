import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick } from "@prisma/client";
import { MARKET_TYPE_LABELS, type MarketType } from "@/lib/markets";

type MatchCardProps = {
  match: Match & {
    markets?: (Market & { options: MarketOption[] })[];
    picks?: (Pick & { market?: Market | null; marketOption?: MarketOption | null })[];
  };
  onPick?: () => void;
  showPickButton?: boolean;
};

const statusStyles = {
  UPCOMING: "badge-pending",
  LIVE: "badge-live",
  FINISHED: "badge-finished",
};

export function MatchCard({ match, onPick, showPickButton = true }: MatchCardProps) {
  const picks = match.picks ?? [];
  const locked = match.status !== "UPCOMING" || new Date(match.startTime) <= new Date();
  const marketCount = match.markets?.length ?? 0;

  return (
    <div className="card hover:border-slate-600 transition">
      <div className="flex items-center justify-between mb-3">
        <span className={`badge ${statusStyles[match.status]}`}>
          {match.status.toLowerCase()}
        </span>
        <span className="text-xs text-slate-500">
          {format(new Date(match.startTime), "MMM d · h:mm a")}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-white">{match.teamA}</p>
          {match.status === "FINISHED" && match.scoreA !== null && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreA}</p>
          )}
        </div>
        <div className="text-slate-500 font-bold">VS</div>
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-white">{match.teamB}</p>
          {match.status === "FINISHED" && match.scoreB !== null && (
            <p className="text-3xl font-black text-emerald-400 mt-1">{match.scoreB}</p>
          )}
        </div>
      </div>

      {marketCount > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          {marketCount} market{marketCount !== 1 ? "s" : ""} available
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
                  {pick.market
                    ? MARKET_TYPE_LABELS[pick.market.type as MarketType]
                    : "Pick"}
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
                  {pick.status}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-white">
                  {pick.marketOption?.label ??
                    (pick.selectedOutcome === "TEAM_A"
                      ? match.teamA
                      : pick.selectedOutcome === "TEAM_B"
                        ? match.teamB
                        : pick.selectedOutcome === "DRAW"
                          ? "Draw"
                          : "—")}
                </span>
                <span className="text-slate-400">
                  {pick.pointsRisked} pts @ x{pick.multiplier}
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
          {picks.length > 0 ? (locked ? "Picks Locked" : "Make / Edit Picks") : locked ? "Locked" : "Make Pick"}
        </button>
      )}
    </div>
  );
}
