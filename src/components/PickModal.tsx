"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Match, Pick, PickOutcome } from "@prisma/client";

type MatchWithPick = Match & { picks?: Pick[] };

type PickModalProps = {
  match: MatchWithPick;
  userPoints: number;
  existingPick?: Pick | null;
  onClose: () => void;
  onSuccess: () => void;
};

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function PickModal({ match, userPoints, existingPick, onClose, onSuccess }: PickModalProps) {
  const [outcome, setOutcome] = useState<PickOutcome>(
    existingPick?.selectedOutcome ?? "TEAM_A"
  );
  const [amount, setAmount] = useState(existingPick?.pointsRisked ?? 25);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locked = match.status !== "UPCOMING" || new Date(match.startTime) <= new Date();
  const pointsRisked = useCustom ? parseInt(customAmount, 10) || 0 : amount;
  const multiplier =
    outcome === "TEAM_A"
      ? match.multiplierTeamA
      : outcome === "DRAW"
        ? match.multiplierDraw
        : match.multiplierTeamB;
  const potentialProfit = Math.round(pointsRisked * multiplier);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, outcome, pointsRisked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pick");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Make Your Pick</h2>
            <p className="text-slate-400 text-sm">
              {format(new Date(match.startTime), "EEE, MMM d · h:mm a")}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>

        {locked ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-amber-300">
            This match has started. Picks are locked.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <OutcomeButton
                label={match.teamA}
                sublabel={`x${match.multiplierTeamA}`}
                selected={outcome === "TEAM_A"}
                onClick={() => setOutcome("TEAM_A")}
              />
              <OutcomeButton
                label="Draw"
                sublabel={`x${match.multiplierDraw}`}
                selected={outcome === "DRAW"}
                onClick={() => setOutcome("DRAW")}
              />
              <OutcomeButton
                label={match.teamB}
                sublabel={`x${match.multiplierTeamB}`}
                selected={outcome === "TEAM_B"}
                onClick={() => setOutcome("TEAM_B")}
              />
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">Points to risk</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={preset > userPoints}
                    onClick={() => {
                      setUseCustom(false);
                      setAmount(preset);
                    }}
                    className={`amount-btn ${!useCustom && amount === preset ? "amount-btn-active" : ""} ${preset > userPoints ? "opacity-40" : ""}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`amount-btn w-full ${useCustom ? "amount-btn-active" : ""}`}
              >
                Custom
              </button>
              {useCustom && (
                <input
                  type="number"
                  min={1}
                  max={userPoints}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`Max ${userPoints}`}
                  className="input mt-2"
                />
              )}
            </div>

            <div className="rounded-lg bg-slate-800/50 p-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Multiplier</span>
                <span className="text-white">x{multiplier}</span>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Potential profit</span>
                <span className="text-emerald-400 font-semibold">+{potentialProfit}</span>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Your balance</span>
                <span className="text-white">{userPoints.toLocaleString()} pts</span>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || pointsRisked < 1 || pointsRisked > userPoints}
              className="btn-primary w-full"
            >
              {loading ? "Saving..." : existingPick ? "Update Pick" : "Confirm Pick"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function OutcomeButton({
  label,
  sublabel,
  selected,
  onClick,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-xl border p-3 min-h-[80px] transition ${
        selected
          ? "border-emerald-500 bg-emerald-500/20 text-white"
          : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
      }`}
    >
      <span className="font-semibold text-sm text-center leading-tight">{label}</span>
      <span className="text-xs text-slate-400 mt-1">{sublabel}</span>
    </button>
  );
}
