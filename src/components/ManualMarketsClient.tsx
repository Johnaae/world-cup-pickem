"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption } from "@prisma/client";
import { MarketType, OptionStatus } from "@prisma/client";
import {
  BULK_PASTE_EXAMPLE,
} from "@/lib/odds/bulkPaste";
import {
  MANUAL_MARKET_TYPES,
  MARKET_TYPE_LABELS,
} from "@/lib/markets";

type MatchWithMarkets = Match & {
  markets: (Market & { options: MarketOption[] })[];
};

const STATUS_OPTIONS: OptionStatus[] = ["ACTIVE", "SUSPENDED", "CLOSED"];

const emptyForm = {
  label: "",
  pointLine: "",
  multiplier: "",
  status: "ACTIVE" as OptionStatus,
  note: "",
};

export function ManualMarketsClient({
  initialMatches,
}: {
  initialMatches: MatchWithMarkets[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [matchId, setMatchId] = useState(initialMatches[0]?.id ?? "");
  const [marketType, setMarketType] = useState<MarketType>(MarketType.HANDICAP);
  const [form, setForm] = useState(emptyForm);
  const [bulkText, setBulkText] = useState("");
  const [duplicateTargetId, setDuplicateTargetId] = useState("");
  const [duplicateMarketId, setDuplicateMarketId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const selected = matches.find((m) => m.id === matchId);
  const selectedMarket = selected?.markets.find((m) => m.type === marketType);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/manual-markets");
    const data = await res.json();
    if (data.matches) setMatches(data.matches);
  }, []);

  useEffect(() => {
    if (!matchId && matches[0]) setMatchId(matches[0].id);
  }, [matches, matchId]);

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-markets/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          marketType,
          label: form.label,
          pointLine: form.pointLine ? parseFloat(form.pointLine) : null,
          multiplier: parseFloat(form.multiplier),
          status: form.status,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm);
      showMsg("Option saved. Source: Manual.");
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkPaste(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !bulkText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bulk-markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, text: bulkText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg(data.message + (data.errors?.length ? ` (${data.errors.length} warnings)` : ""));
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateOption(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-options/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editForm.label,
          pointLine: editForm.pointLine ? parseFloat(editForm.pointLine) : null,
          multiplier: parseFloat(editForm.multiplier),
          status: editForm.status,
          note: editForm.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      showMsg("Option updated.");
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOption(id: string) {
    if (!confirm("Delete this option?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-options/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg("Option deleted.");
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: OptionStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-options/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg(`Option marked ${status}.`);
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate() {
    if (!duplicateMarketId || !duplicateTargetId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-markets/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMarketId: duplicateMarketId,
          targetMatchId: duplicateTargetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg("Market duplicated to target match.");
      setDuplicateMarketId("");
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }

  const allMarkets = selected?.markets.filter((m) => m.provider === "MANUAL" || MANUAL_MARKET_TYPES.includes(m.type)) ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
        Virtual points only — no payments, no real money, no cash prizes. Points have no monetary value.
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
        <h2 className="text-lg font-bold text-white mb-4">Select Match</h2>
        <select
          className="input"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
        >
          {matches.length === 0 ? (
            <option value="">No upcoming or live matches</option>
          ) : (
            matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} vs {m.teamB} · {format(new Date(m.startTime), "MMM d, h:mm a")} · {m.status}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4">Add Option Manually</h2>
          <form onSubmit={handleAddOption} className="space-y-3">
            <div>
              <label className="label">Market type</label>
              <select
                className="input"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value as MarketType)}
              >
                {MANUAL_MARKET_TYPES.map((t) => (
                  <option key={t} value={t}>{MARKET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Label</label>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="France -1.5" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Line (optional)</label>
                <input className="input" type="number" step="0.5" value={form.pointLine} onChange={(e) => setForm({ ...form, pointLine: e.target.value })} placeholder="-1.5" />
              </div>
              <div>
                <label className="label">Multiplier</label>
                <input className="input" type="number" step="0.01" min="0.01" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} placeholder="0.92" required />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OptionStatus })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Admin note" />
            </div>
            <p className="text-xs text-slate-500">Source: Manual</p>
            <button type="submit" disabled={loading || !matchId} className="btn-primary w-full">
              {loading ? "Saving..." : "Add Option"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-white mb-2">Bulk Paste</h2>
          <p className="text-sm text-slate-400 mb-4">
            Paste real lines from any source. Creates markets if missing, updates existing labels.
          </p>
          <form onSubmit={handleBulkPaste} className="space-y-3">
            <div className="flex justify-end">
              <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setBulkText(BULK_PASTE_EXAMPLE)}>
                Load example
              </button>
            </div>
            <textarea
              className="input min-h-[240px] font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Market: Handicap&#10;..."
            />
            <button type="submit" disabled={loading || !matchId} className="btn-primary w-full">
              {loading ? "Importing..." : "Import Bulk Paste"}
            </button>
          </form>
        </div>
      </div>

      {selectedMarket && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {MARKET_TYPE_LABELS[selectedMarket.type as MarketType]} · Manual
            </h2>
            {selectedMarket.settledAt && (
              <span className="text-xs rounded-full bg-amber-500/20 text-amber-300 px-3 py-1">
                Settled {format(new Date(selectedMarket.settledAt), "PPp")}
              </span>
            )}
          </div>

          {selectedMarket.options.length === 0 ? (
            <p className="text-sm text-slate-500">No options yet for this market type.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Line</th>
                    <th className="py-2 pr-3">Mult.</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Note</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMarket.options.map((opt) => (
                    <tr key={opt.id} className="border-t border-slate-800">
                      {editingId === opt.id ? (
                        <>
                          <td className="py-2 pr-3">
                            <input className="input text-xs" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3">
                            <input className="input text-xs w-20" value={editForm.pointLine} onChange={(e) => setEditForm({ ...editForm, pointLine: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3">
                            <input className="input text-xs w-20" value={editForm.multiplier} onChange={(e) => setEditForm({ ...editForm, multiplier: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3">
                            <select className="input text-xs" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as OptionStatus })}>
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <input className="input text-xs" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                          </td>
                          <td className="py-2">
                            <button type="button" onClick={() => handleUpdateOption(opt.id)} className="text-xs text-emerald-400 mr-2">Save</button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-3 text-white">{opt.label}</td>
                          <td className="py-2 pr-3 text-slate-400">{opt.pointLine ?? "—"}</td>
                          <td className="py-2 pr-3 text-slate-300">x{opt.multiplier}</td>
                          <td className="py-2 pr-3">
                            <span className={`text-xs font-semibold ${
                              opt.status === "ACTIVE" ? "text-emerald-400" :
                              opt.status === "SUSPENDED" ? "text-amber-400" : "text-red-400"
                            }`}>
                              {opt.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-slate-500 text-xs">{opt.note ?? "—"}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(opt.id);
                                  setEditForm({
                                    label: opt.label,
                                    pointLine: opt.pointLine?.toString() ?? "",
                                    multiplier: opt.multiplier.toString(),
                                    status: opt.status,
                                    note: opt.note ?? "",
                                  });
                                }}
                                className="text-xs text-slate-300 hover:underline"
                              >
                                Edit
                              </button>
                              {opt.status !== "SUSPENDED" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "SUSPENDED")} className="text-xs text-amber-400 hover:underline">Suspend</button>
                              )}
                              {opt.status !== "CLOSED" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "CLOSED")} className="text-xs text-orange-400 hover:underline">Close</button>
                              )}
                              {opt.status !== "ACTIVE" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "ACTIVE")} className="text-xs text-emerald-400 hover:underline">Activate</button>
                              )}
                              <button type="button" onClick={() => handleDeleteOption(opt.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold text-white mb-4">Duplicate Market to Another Match</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" value={duplicateMarketId} onChange={(e) => setDuplicateMarketId(e.target.value)}>
            <option value="">Source market...</option>
            {allMarkets.map((m) => (
              <option key={m.id} value={m.id}>
                {MARKET_TYPE_LABELS[m.type as MarketType]} ({m.options.length} opts)
              </option>
            ))}
          </select>
          <select className="input" value={duplicateTargetId} onChange={(e) => setDuplicateTargetId(e.target.value)}>
            <option value="">Target match...</option>
            {matches.filter((m) => m.id !== matchId).map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} vs {m.teamB}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleDuplicate} disabled={loading || !duplicateMarketId || !duplicateTargetId} className="btn-secondary">
            Duplicate
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        After a match, settle manual markets on the{" "}
        <a href="/admin/manual-settlement" className="text-emerald-400 hover:underline">Manual Settlement</a> page.
      </p>
    </div>
  );
}
