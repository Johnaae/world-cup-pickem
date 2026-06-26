"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick as UserPick, User } from "@prisma/client";
import { MARKET_TYPE_LABELS, type MarketType } from "@/lib/markets";

type AdminMatch = Match & {
  markets: (Market & { options: MarketOption[] })[];
  picks: (UserPick & {
    user: Pick<User, "id" | "name" | "email">;
    market?: Market | null;
    marketOption?: MarketOption | null;
  })[];
};

export function AdminClient({
  initialMatches,
  lastSyncedAt,
}: {
  initialMatches: AdminMatch[];
  lastSyncedAt: string | null;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [form, setForm] = useState({
    teamA: "",
    teamB: "",
    startTime: "",
    multiplierTeamA: "1.5",
    multiplierDraw: "3.0",
    multiplierTeamB: "2.5",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState({ scoreA: "", scoreB: "", scoreHalfA: "", scoreHalfB: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const [expandedMarkets, setExpandedMarkets] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/matches");
    const data = await res.json();
    setMatches(data.matches);
  }

  async function handleSync() {
    setSyncing(true);
    setMessage("");
    setSyncSummary(null);
    try {
      const res = await fetch("/api/admin/sync-odds");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync matches and multipliers.");
      setMessage("Markets synced from The Odds API successfully.");
      setMessageType("success");
      setSyncedAt(data.lastSyncedAt ?? new Date().toISOString());
      setSyncSummary(
        `Imported ${data.importedMatches} matches, updated ${data.updatedMatches}. ` +
          `Imported ${data.importedMarkets} markets, updated ${data.updatedMarkets}.` +
          (data.missingMarkets?.length
            ? ` Unavailable: ${data.missingMarkets.join(", ")}.`
            : "")
      );
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to sync matches and multipliers.");
      setMessageType("error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleManualSettle(pickId: string, status: "WON" | "LOST") {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/picks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Pick marked as ${status}.`);
      setMessageType("success");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("success");
    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA: form.teamA,
          teamB: form.teamB,
          startTime: form.startTime,
          multiplierTeamA: parseFloat(form.multiplierTeamA),
          multiplierDraw: parseFloat(form.multiplierDraw),
          multiplierTeamB: parseFloat(form.multiplierTeamB),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ teamA: "", teamB: "", startTime: "", multiplierTeamA: "1.5", multiplierDraw: "3.0", multiplierTeamB: "2.5" });
      setMessage("Match created!");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSettle(matchId: string) {
    setLoading(true);
    setMessage("");
    setMessageType("success");
    try {
      const res = await fetch("/api/admin/matches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: matchId,
          scoreA: parseInt(scoreForm.scoreA, 10),
          scoreB: parseInt(scoreForm.scoreB, 10),
          scoreHalfA: scoreForm.scoreHalfA ? parseInt(scoreForm.scoreHalfA, 10) : null,
          scoreHalfB: scoreForm.scoreHalfB ? parseInt(scoreForm.scoreHalfB, 10) : null,
          settle: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Match settled and points recalculated!");
      setEditingId(null);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this match and all picks?")) return;
    await fetch(`/api/admin/matches?id=${id}`, { method: "DELETE" });
    await refresh();
  }

  async function handleResetPoints() {
    if (!confirm("Reset ALL users to starting points?")) return;
    await fetch("/api/admin/matches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_points" }),
    });
    setMessage("All user points reset!");
    setMessageType("success");
  }

  return (
    <div className="space-y-8">
      <div className="card">
        <h2 className="text-lg font-bold text-white mb-2">Sync The Odds API</h2>
        <p className="text-sm text-slate-400 mb-4">
          Automatically import matches and market multipliers from The Odds API. Virtual points only — no real money.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleSync} disabled={syncing || loading} className="btn-primary">
            {syncing ? "Syncing..." : "Sync The Odds API Markets"}
          </button>
          <span className="text-sm text-slate-400">
            Last synced: {syncedAt ? format(new Date(syncedAt), "PPp") : "Never synced"}
          </span>
        </div>
        {syncSummary && <p className="text-xs text-slate-500 mt-3">{syncSummary}</p>}
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-white mb-2">Manual Markets</h2>
        <p className="text-sm text-slate-400 mb-4">
          Enter advanced markets (handicap, corners, BTTS, correct score, etc.) from any source. Virtual points only.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/manual-markets" className="btn-primary">Manual Market Entry</a>
          <a href="/admin/manual-settlement" className="btn-secondary">Manual Settlement</a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/api/admin/export" className="btn-secondary">Export Leaderboard CSV</a>
        <button onClick={handleResetPoints} className="btn-danger">Reset All Points</button>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${
          messageType === "success"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          {message}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold text-white mb-4">Add Match Manually</h2>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Team A" value={form.teamA} onChange={(e) => setForm({ ...form, teamA: e.target.value })} required />
          <input className="input" placeholder="Team B" value={form.teamB} onChange={(e) => setForm({ ...form, teamB: e.target.value })} required />
          <input className="input sm:col-span-2" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
          <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">Create Match</button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="section-title">All Matches</h2>
        {matches.map((match) => (
          <div key={match.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{match.teamA} vs {match.teamB}</h3>
                <p className="text-sm text-slate-400">
                  {format(new Date(match.startTime), "PPp")} · {match.status}
                  {match.scoreA !== null && ` · FT ${match.scoreA}-${match.scoreB}`}
                  {match.scoreHalfA !== null && ` · HT ${match.scoreHalfA}-${match.scoreHalfB}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(editingId === match.id ? null : match.id);
                    setScoreForm({
                      scoreA: match.scoreA?.toString() ?? "",
                      scoreB: match.scoreB?.toString() ?? "",
                      scoreHalfA: match.scoreHalfA?.toString() ?? "",
                      scoreHalfB: match.scoreHalfB?.toString() ?? "",
                    });
                  }}
                  className="btn-secondary text-sm"
                >
                  {editingId === match.id ? "Cancel" : "Set Result"}
                </button>
                <button onClick={() => setExpandedMarkets(expandedMarkets === match.id ? null : match.id)} className="btn-secondary text-sm">
                  Markets ({match.markets.length})
                </button>
                <button onClick={() => handleDelete(match.id)} className="btn-danger text-sm">Delete</button>
              </div>
            </div>

            {editingId === match.id && (
              <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-slate-800/50">
                <input className="input w-20" type="number" min={0} placeholder="FT A" value={scoreForm.scoreA} onChange={(e) => setScoreForm({ ...scoreForm, scoreA: e.target.value })} />
                <input className="input w-20" type="number" min={0} placeholder="FT B" value={scoreForm.scoreB} onChange={(e) => setScoreForm({ ...scoreForm, scoreB: e.target.value })} />
                <input className="input w-20" type="number" min={0} placeholder="HT A" value={scoreForm.scoreHalfA} onChange={(e) => setScoreForm({ ...scoreForm, scoreHalfA: e.target.value })} />
                <input className="input w-20" type="number" min={0} placeholder="HT B" value={scoreForm.scoreHalfB} onChange={(e) => setScoreForm({ ...scoreForm, scoreHalfB: e.target.value })} />
                <button onClick={() => handleSettle(match.id)} disabled={loading} className="btn-primary text-sm">
                  Save & Recalculate
                </button>
              </div>
            )}

            {expandedMarkets === match.id && (
              <div className="mb-4 space-y-3">
                {match.markets.length === 0 ? (
                  <p className="text-sm text-slate-500">No markets yet. Sync from The Odds API or use Bulk Market Entry below.</p>
                ) : (
                  match.markets.map((market) => (
                    <div key={market.id} className="rounded-lg bg-slate-800/40 p-3">
                      <p className="text-sm font-semibold text-white mb-2">
                        {MARKET_TYPE_LABELS[market.type as MarketType]} · {market.provider === "MANUAL" ? "Manual" : market.provider === "THEODDSAPI" ? "The Odds API" : market.provider} ({market.options.length} options)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {market.options.map((opt) => (
                          <span key={opt.id} className="text-xs rounded-lg bg-slate-900 px-2 py-1 text-slate-300">
                            {opt.label} · x{opt.multiplier}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <p className="text-xs text-amber-400/80">Advanced markets may require admin settlement.</p>
              </div>
            )}

            {match.picks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Market</th>
                      <th className="py-2 pr-4">Pick</th>
                      <th className="py-2 pr-4">Risked</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.picks.map((pick) => (
                      <tr key={pick.id} className="border-t border-slate-800">
                        <td className="py-2 pr-4 text-white">{pick.user.name}</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {pick.market ? MARKET_TYPE_LABELS[pick.market.type as MarketType] : "Legacy"}
                        </td>
                        <td className="py-2 pr-4 text-slate-300">{pick.marketOption?.label ?? pick.selectedOutcome}</td>
                        <td className="py-2 pr-4 text-slate-300">{pick.pointsRisked}</td>
                        <td className={`py-2 pr-4 font-semibold ${
                          pick.status === "WON" ? "text-emerald-400" : pick.status === "LOST" ? "text-red-400" : "text-amber-400"
                        }`}>
                          {pick.status}
                        </td>
                        <td className="py-2">
                          {pick.status === "PENDING" && (
                            <div className="flex gap-1">
                              <button onClick={() => handleManualSettle(pick.id, "WON")} className="text-xs text-emerald-400 hover:underline">Win</button>
                              <button onClick={() => handleManualSettle(pick.id, "LOST")} className="text-xs text-red-400 hover:underline">Loss</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
