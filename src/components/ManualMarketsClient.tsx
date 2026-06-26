"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption } from "@prisma/client";
import { MarketType, OptionStatus } from "@prisma/client";
import {
  BULK_PASTE_EXAMPLE,
} from "@/lib/odds/bulkPaste";
import { MANUAL_MARKET_TYPES } from "@/lib/markets";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";
import { AdminSyncButtons } from "./AdminSyncButtons";

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
  const { t, locale, fmt, te } = useI18n();
  const dateLocale = getDateFnsLocale(locale);
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
      if (!res.ok) throw new Error(te(data.error));
      setForm(emptyForm);
      showMsg(t.manualMarkets.optionSaved);
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
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
      if (!res.ok) throw new Error(te(data.error));
      showMsg(data.message + (data.errors?.length ? ` (${data.errors.length} warnings)` : ""));
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : te(undefined, "IMPORT_FAILED"), "error");
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
      if (!res.ok) throw new Error(te(data.error));
      setEditingId(null);
      showMsg(t.manualMarkets.optionUpdated);
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOption(id: string) {
    if (!confirm(t.manualMarkets.deleteOptionConfirm)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-options/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));
      showMsg(t.manualMarkets.optionDeleted);
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
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
      if (!res.ok) throw new Error(te(data.error));
      showMsg(fmt(t.manualMarkets.optionStatusChanged, { status: t.optionStatus[status] }));
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
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
      if (!res.ok) throw new Error(te(data.error));
      showMsg(t.manualMarkets.duplicated);
      setDuplicateMarketId("");
      await refresh();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setLoading(false);
    }
  }

  const allMarkets = selected?.markets.filter((m) => m.provider === "MANUAL" || MANUAL_MARKET_TYPES.includes(m.type)) ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
        {t.manualMarkets.safetyNotice}
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/admin/import-image" className="btn-primary">{t.manualMarkets.importFromImage}</a>
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
        <h2 className="text-lg font-bold text-white mb-4">{t.manualMarkets.selectMatch}</h2>
        <select
          className="input"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
        >
          {matches.length === 0 ? (
            <option value="">{t.manualMarkets.noMatches}</option>
          ) : (
            matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} {t.matches.vs} {m.teamB} · {format(new Date(m.startTime), "MMM d, h:mm a", { locale: dateLocale })} · {t.matchStatus[m.status]}
              </option>
            ))
          )}
        </select>
        {matchId && (
          <div className="mt-4">
            <AdminSyncButtons matchId={matchId} onSynced={refresh} compact />
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4">{t.manualMarkets.addOptionTitle}</h2>
          <form onSubmit={handleAddOption} className="space-y-3">
            <div>
              <label className="label">{t.manualMarkets.marketType}</label>
              <select
                className="input"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value as MarketType)}
              >
                {MANUAL_MARKET_TYPES.map((mt) => (
                  <option key={mt} value={mt}>{t.markets[mt]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t.manualMarkets.label}</label>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t.manualMarkets.labelPlaceholder} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t.manualMarkets.lineOptional}</label>
                <input className="input" type="number" step="0.5" value={form.pointLine} onChange={(e) => setForm({ ...form, pointLine: e.target.value })} placeholder="-1.5" />
              </div>
              <div>
                <label className="label">{t.manualMarkets.multiplier}</label>
                <input className="input" type="number" step="0.01" min="0.01" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} placeholder="0.92" required />
              </div>
            </div>
            <div>
              <label className="label">{t.admin.status}</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OptionStatus })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t.optionStatus[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t.manualMarkets.noteOptional}</label>
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t.manualMarkets.notePlaceholder} />
            </div>
            <p className="text-xs text-slate-500">{t.manualMarkets.sourceManual}</p>
            <button type="submit" disabled={loading || !matchId} className="btn-primary w-full">
              {loading ? t.manualMarkets.saving : t.manualMarkets.addOption}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-white mb-2">{t.manualMarkets.bulkPasteTitle}</h2>
          <p className="text-sm text-slate-400 mb-4">
            {t.manualMarkets.bulkPasteDesc}
          </p>
          <form onSubmit={handleBulkPaste} className="space-y-3">
            <div className="flex justify-end">
              <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setBulkText(BULK_PASTE_EXAMPLE)}>
                {t.manualMarkets.loadExample}
              </button>
            </div>
            <textarea
              className="input min-h-[240px] font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={t.manualMarkets.bulkFormatHint}
            />
            <button type="submit" disabled={loading || !matchId} className="btn-primary w-full">
              {loading ? t.manualMarkets.importing : t.manualMarkets.importBulk}
            </button>
          </form>
        </div>
      </div>

      {selectedMarket && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {t.markets[selectedMarket.type as MarketType]} · {t.admin.manualSource}
            </h2>
            {selectedMarket.settledAt && (
              <span className="text-xs rounded-full bg-amber-500/20 text-amber-300 px-3 py-1">
                {fmt(t.manualMarkets.settledAt, { date: format(new Date(selectedMarket.settledAt), "PPp", { locale: dateLocale }) })}
              </span>
            )}
          </div>

          {selectedMarket.options.length === 0 ? (
            <p className="text-sm text-slate-500">{t.manualMarkets.noOptionsYet}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="py-2 pr-3">{t.manualMarkets.label}</th>
                    <th className="py-2 pr-3">{t.manualMarkets.line}</th>
                    <th className="py-2 pr-3">{t.manualMarkets.mult}</th>
                    <th className="py-2 pr-3">{t.admin.status}</th>
                    <th className="py-2 pr-3">{t.manualMarkets.note}</th>
                    <th className="py-2">{t.manualMarkets.actions}</th>
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
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t.optionStatus[s]}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <input className="input text-xs" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                          </td>
                          <td className="py-2">
                            <button type="button" onClick={() => handleUpdateOption(opt.id)} className="text-xs text-emerald-400 mr-2">{t.common.save}</button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-400">{t.common.cancel}</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-3 text-white">{opt.label}</td>
                          <td className="py-2 pr-3 text-slate-400">{opt.pointLine ?? t.common.na}</td>
                          <td className="py-2 pr-3 text-slate-300">x{opt.multiplier}</td>
                          <td className="py-2 pr-3">
                            <span className={`text-xs font-semibold ${
                              opt.status === "ACTIVE" ? "text-emerald-400" :
                              opt.status === "SUSPENDED" ? "text-amber-400" : "text-red-400"
                            }`}>
                              {t.optionStatus[opt.status]}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-slate-500 text-xs">{opt.note ?? t.common.na}</td>
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
                                {t.manualMarkets.edit}
                              </button>
                              {opt.status !== "SUSPENDED" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "SUSPENDED")} className="text-xs text-amber-400 hover:underline">{t.manualMarkets.suspend}</button>
                              )}
                              {opt.status !== "CLOSED" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "CLOSED")} className="text-xs text-orange-400 hover:underline">{t.manualMarkets.close}</button>
                              )}
                              {opt.status !== "ACTIVE" && (
                                <button type="button" onClick={() => handleStatusChange(opt.id, "ACTIVE")} className="text-xs text-emerald-400 hover:underline">{t.manualMarkets.activate}</button>
                              )}
                              <button type="button" onClick={() => handleDeleteOption(opt.id)} className="text-xs text-red-400 hover:underline">{t.admin.delete}</button>
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
        <h2 className="text-lg font-bold text-white mb-4">{t.manualMarkets.duplicateTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" value={duplicateMarketId} onChange={(e) => setDuplicateMarketId(e.target.value)}>
            <option value="">{t.manualMarkets.sourceMarket}</option>
            {allMarkets.map((m) => (
              <option key={m.id} value={m.id}>
                {t.markets[m.type as MarketType]} ({fmt(t.admin.optionsCount, { count: m.options.length })})
              </option>
            ))}
          </select>
          <select className="input" value={duplicateTargetId} onChange={(e) => setDuplicateTargetId(e.target.value)}>
            <option value="">{t.manualMarkets.targetMatch}</option>
            {matches.filter((m) => m.id !== matchId).map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} {t.matches.vs} {m.teamB}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleDuplicate} disabled={loading || !duplicateMarketId || !duplicateTargetId} className="btn-secondary">
            {t.manualMarkets.duplicate}
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {t.manualMarkets.settlementLink}{" "}
        <a href="/admin/manual-settlement" className="text-emerald-400 hover:underline">{t.manualMarkets.settlementLinkText}</a>
      </p>
    </div>
  );
}
