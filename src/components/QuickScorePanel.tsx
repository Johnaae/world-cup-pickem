"use client";

import { useState } from "react";
import type { Match, MatchStatus } from "@prisma/client";
import { useI18n } from "@/i18n/context";

const STATUSES: MatchStatus[] = ["UPCOMING", "LIVE", "FINISHED"];

type QuickScorePanelProps = {
  match: Pick<Match, "id" | "teamA" | "teamB" | "scoreA" | "scoreB" | "status">;
  onSaved?: () => void;
  onCancel?: () => void;
  compact?: boolean;
};

export function QuickScorePanel({ match, onSaved, onCancel, compact = false }: QuickScorePanelProps) {
  const { t, te } = useI18n();
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/matches/quick-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: match.id,
          scoreA: scoreA === "" ? null : parseInt(scoreA, 10),
          scoreB: scoreB === "" ? null : parseInt(scoreB, 10),
          status,
        }),
      });

      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError(t.common.somethingWrong);
        return;
      }

      if (!data.ok) {
        setError(data.error ? te(data.error) : t.common.failed);
        return;
      }

      onSaved?.();
    } catch (err) {
      console.error("[QuickScorePanel] save failed:", err);
      setError(err instanceof Error ? err.message : t.common.somethingWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-lg bg-slate-800/50 border border-slate-700 ${compact ? "p-3 mt-3" : "p-4 mb-3"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-slate-400 mb-2">
        {match.teamA} {t.matches.vs} {match.teamB}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label text-xs">{t.admin.homeScore}</label>
          <input
            type="number"
            min={0}
            className="input w-20"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-xs">{t.admin.awayScore}</label>
          <input
            type="number"
            min={0}
            className="input w-20"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-xs">{t.admin.status}</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.matchStatus[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleSave} disabled={loading} className="btn-primary text-sm">
          {loading ? t.common.loading : t.common.save}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">
            {t.common.cancel}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
