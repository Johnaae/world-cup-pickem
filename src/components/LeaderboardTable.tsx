"use client";

import { useI18n } from "@/i18n/context";

export type LeaderboardEntry = {
  rank: number;
  id?: string;
  name: string;
  points: number;
  totalPicks: number;
  correctPicks: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
};

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  highlightUserId?: string;
  compact?: boolean;
};

export function LeaderboardTable({ entries, highlightUserId, compact = false }: LeaderboardTableProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-slate-400 text-left">
            <th className="px-4 py-3 font-medium">{t.leaderboard.rank}</th>
            <th className="px-4 py-3 font-medium">{t.leaderboard.player}</th>
            <th className="px-4 py-3 font-medium">{t.leaderboard.points}</th>
            {!compact && (
              <>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">{t.leaderboard.picks}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t.leaderboard.correct}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t.leaderboard.winRate}</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">{t.leaderboard.bestWin}</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">{t.leaderboard.worstLoss}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isHighlighted = highlightUserId && entry.id === highlightUserId;
            const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;

            return (
              <tr
                key={entry.rank + entry.name}
                className={`border-t border-slate-800 ${
                  isHighlighted ? "bg-emerald-500/10" : entry.rank <= 3 ? "bg-slate-900/50" : ""
                }`}
              >
                <td className="px-4 py-3 font-bold text-slate-300">{medal || entry.rank}</td>
                <td className="px-4 py-3 font-semibold text-white">{entry.name}</td>
                <td className="px-4 py-3 font-bold text-emerald-400">{entry.points.toLocaleString()}</td>
                {!compact && (
                  <>
                    <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{entry.totalPicks}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{entry.correctPicks}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{entry.winRate}%</td>
                    <td className="px-4 py-3 text-emerald-400 hidden lg:table-cell">+{entry.biggestWin}</td>
                    <td className="px-4 py-3 text-red-400 hidden lg:table-cell">{entry.biggestLoss}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
