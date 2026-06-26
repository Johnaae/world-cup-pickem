import { format } from "date-fns";
import type { Match, Pick } from "@prisma/client";

type MatchCardProps = {
  match: Match & { picks?: Pick[] };
  onPick?: () => void;
  showPickButton?: boolean;
};

const statusStyles = {
  UPCOMING: "badge-pending",
  LIVE: "badge-live",
  FINISHED: "badge-finished",
};

export function MatchCard({ match, onPick, showPickButton = true }: MatchCardProps) {
  const pick = match.picks?.[0];
  const locked = match.status !== "UPCOMING" || new Date(match.startTime) <= new Date();

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

      {pick && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          pick.status === "WON"
            ? "bg-emerald-500/10 border border-emerald-500/30"
            : pick.status === "LOST"
              ? "bg-red-500/10 border border-red-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
        }`}>
          <div className="flex justify-between">
            <span className="text-slate-400">Your pick</span>
            <span className={`font-semibold ${
              pick.status === "WON" ? "text-emerald-400" : pick.status === "LOST" ? "text-red-400" : "text-amber-400"
            }`}>
              {pick.status}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white">
              {pick.selectedOutcome === "TEAM_A"
                ? match.teamA
                : pick.selectedOutcome === "TEAM_B"
                  ? match.teamB
                  : "Draw"}
            </span>
            <span className="text-slate-400">{pick.pointsRisked} pts @ x{pick.multiplier}</span>
          </div>
        </div>
      )}

      {showPickButton && onPick && (
        <button
          onClick={onPick}
          className={`mt-4 w-full ${locked && !pick ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}
          disabled={locked && !pick}
        >
          {pick ? (locked ? "Pick Locked" : "Edit Pick") : locked ? "Locked" : "Make Pick"}
        </button>
      )}
    </div>
  );
}
