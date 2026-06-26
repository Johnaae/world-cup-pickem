"use client";

import { useState } from "react";
import { BULK_PASTE_EXAMPLE } from "@/lib/odds/bulkPaste";

type MatchOption = {
  id: string;
  teamA: string;
  teamB: string;
  status: string;
};

export function BulkMarketEntry({
  matches,
  onSuccess,
}: {
  matches: MatchOption[];
  onSuccess: () => void;
}) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const selected = matches.find((m) => m.id === matchId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !text.trim()) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/bulk-markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMessage(data.message);
      setMessageType("success");
      if (data.errors?.length) {
        setMessage(`${data.message} Warnings: ${data.errors.join(" ")}`);
      }
      onSuccess();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-white mb-2">Bulk Market Entry</h2>
      <p className="text-sm text-slate-400 mb-4">
        Paste real lines from any source you are viewing. Options are saved as Manual — virtual points only.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Select match</label>
          <select
            className="input"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            required
          >
            {matches.length === 0 ? (
              <option value="">No matches available</option>
            ) : (
              matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.teamA} vs {m.teamB} ({m.status.toLowerCase()})
                </option>
              ))
            )}
          </select>
        </div>

        {selected && (
          <p className="text-xs text-slate-500">
            Team names in paste must match: <strong className="text-slate-300">{selected.teamA}</strong> and{" "}
            <strong className="text-slate-300">{selected.teamB}</strong>
          </p>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label !mb-0">Paste markets</label>
            <button
              type="button"
              className="text-xs text-emerald-400 hover:underline"
              onClick={() => setText(BULK_PASTE_EXAMPLE)}
            >
              Load example
            </button>
          </div>
          <textarea
            className="input min-h-[220px] font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Market: Handicap\n${selected?.teamA ?? "Team A"} -1.5 | 1.92\n...`}
            required
          />
        </div>

        <p className="text-xs text-slate-500">
          Format: <code className="text-slate-400">Market: [type]</code> then{" "}
          <code className="text-slate-400">Label | decimal</code> per line. Decimal price → multiplier automatically.
        </p>

        {message && (
          <p className={`text-sm ${messageType === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
        )}

        <button type="submit" disabled={loading || !matchId} className="btn-primary">
          {loading ? "Importing..." : "Import Manual Markets"}
        </button>
      </form>
    </div>
  );
}
