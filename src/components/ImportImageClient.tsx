"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { Match, MatchStatus } from "@prisma/client";
import { MarketType, OptionStatus } from "@prisma/client";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";
import { AI_SUPPORTED_MARKET_TYPES, MAX_IMAGES, type PreviewRow } from "@/lib/ai/types";
import { decimalToMultiplier } from "@/lib/odds/utils";

type MatchOption = Pick<Match, "id" | "teamA" | "teamB" | "startTime" | "status">;

export function ImportImageClient({ matches }: { matches: MatchOption[] }) {
  const { t, locale, fmt, te } = useI18n();
  const dateLocale = getDateFnsLocale(locale);

  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [bookmakerPreference, setBookmakerPreference] = useState("");
  const [saveForAudit, setSaveForAudit] = useState(false);
  const [confirmNeedsReview, setConfirmNeedsReview] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PreviewRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const selected = matches.find((m) => m.id === matchId);
  const activePreview = preview.filter((r) => !r.deleted);

  const statusLabel = (status: MatchStatus) => t.matchStatus[status];

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  function handleFilesChange(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).slice(0, MAX_IMAGES);
    setFiles(next);
  }

  async function handleExtract() {
    if (!matchId || files.length === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("matchId", matchId);
      files.forEach((f) => formData.append("images", f));
      if (bookmakerPreference.trim()) {
        formData.append("bookmakerPreference", bookmakerPreference.trim());
      }
      if (saveForAudit) formData.append("saveForAudit", "true");

      const res = await fetch("/api/admin/import-image-odds", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));

      setPreview(data.preview ?? []);
      setWarnings(data.warnings ?? []);
      setConfidence(data.confidence ?? null);
      showMsg(t.importImage.extractionComplete);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!matchId || activePreview.length === 0) return;
    setImporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/import-image-odds/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          rows: preview,
          confirmNeedsReview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));

      showMsg(
        fmt(t.importImage.importSummary, {
          created: data.createdOptions ?? 0,
          updated: data.updatedOptions ?? 0,
          skipped: data.skippedNeedsReview ?? 0,
        })
      );
      setPreview([]);
      setWarnings([]);
      setConfidence(null);
      setFiles([]);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setImporting(false);
    }
  }

  function startEdit(row: PreviewRow) {
    setEditingId(row.id);
    setEditDraft({ ...row });
  }

  function saveEdit() {
    if (!editDraft) return;
    const decimal = editDraft.decimalOdds;
    const updated = {
      ...editDraft,
      multiplier: decimalToMultiplier(decimal),
    };
    setPreview((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditingId(null);
    setEditDraft(null);
  }

  function deleteRow(id: string) {
    setPreview((prev) => prev.map((r) => (r.id === id ? { ...r, deleted: true } : r)));
  }

  const needsReviewCount = useMemo(
    () => activePreview.filter((r) => r.needsReview).length,
    [activePreview]
  );

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
        {t.importImage.safetyNotice}
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            messageType === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-lg font-bold text-white">{t.importImage.selectMatch}</h2>
        <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          {matches.length === 0 ? (
            <option value="">{t.importImage.noMatches}</option>
          ) : (
            matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} vs {m.teamB} · {format(new Date(m.startTime), "MMM d, HH:mm", { locale: dateLocale })} · {statusLabel(m.status)}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold text-white">{t.importImage.uploadScreenshots}</h2>
        <p className="text-sm text-slate-400">{t.importImage.uploadHint}</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="input"
          onChange={(e) => handleFilesChange(e.target.files)}
        />
        {files.length > 0 && (
          <ul className="text-xs text-slate-500 space-y-1">
            {files.map((f) => (
              <li key={f.name}>
                {t.importImage.sourceImage}: {f.name} ({(f.size / 1024).toFixed(0)} KB)
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className="label">{t.importImage.bookmakerPreference}</label>
          <input
            className="input"
            value={bookmakerPreference}
            onChange={(e) => setBookmakerPreference(e.target.value)}
            placeholder={t.importImage.bookmakerPlaceholder}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={saveForAudit}
            onChange={(e) => setSaveForAudit(e.target.checked)}
          />
          {t.importImage.saveForAudit}
        </label>
        <button
          type="button"
          onClick={handleExtract}
          disabled={loading || !matchId || files.length === 0}
          className="btn-primary"
        >
          {loading ? t.importImage.reading : t.importImage.readWithAi}
        </button>
      </div>

      {(confidence !== null || warnings.length > 0) && (
        <div className="card space-y-2">
          {confidence !== null && (
            <p className="text-sm text-slate-300">
              {t.importImage.confidence}: <span className="text-emerald-400 font-semibold">{(confidence * 100).toFixed(0)}%</span>
            </p>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">{t.importImage.warnings}</p>
              <ul className="text-xs text-amber-300/80 list-disc pl-5 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">{t.importImage.previewImport}</h2>
          {needsReviewCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-amber-400">
              <input
                type="checkbox"
                checked={confirmNeedsReview}
                onChange={(e) => setConfirmNeedsReview(e.target.checked)}
              />
              {t.importImage.confirmNeedsReview} ({needsReviewCount})
            </label>
          )}
        </div>

        {activePreview.length === 0 ? (
          <p className="text-sm text-slate-500">{t.importImage.noPreview}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="py-2 pr-2">{t.importImage.marketType}</th>
                  <th className="py-2 pr-2">{t.importImage.optionLabel}</th>
                  <th className="py-2 pr-2">{t.importImage.line}</th>
                  <th className="py-2 pr-2">{t.importImage.decimalOdds}</th>
                  <th className="py-2 pr-2">{t.importImage.source}</th>
                  <th className="py-2 pr-2">{t.importImage.status}</th>
                  <th className="py-2 pr-2">{t.importImage.needsReview}</th>
                  <th className="py-2">{t.manualMarkets.actions}</th>
                </tr>
              </thead>
              <tbody>
                {activePreview.map((row) =>
                  editingId === row.id && editDraft ? (
                    <tr key={row.id} className="border-t border-slate-800">
                      <td className="py-2 pr-2">
                        <select
                          className="input text-xs"
                          value={editDraft.marketType}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              marketType: e.target.value as MarketType,
                              marketLabel: t.markets[e.target.value as MarketType],
                            })
                          }
                        >
                          {AI_SUPPORTED_MARKET_TYPES.map((mt) => (
                            <option key={mt} value={mt}>{t.markets[mt]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input className="input text-xs" value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
                      </td>
                      <td className="py-2 pr-2">
                        <input className="input text-xs w-20" type="number" step="0.5" value={editDraft.line ?? ""} onChange={(e) => setEditDraft({ ...editDraft, line: e.target.value ? parseFloat(e.target.value) : null })} />
                      </td>
                      <td className="py-2 pr-2">
                        <input className="input text-xs w-20" type="number" step="0.01" min="1.01" value={editDraft.decimalOdds} onChange={(e) => setEditDraft({ ...editDraft, decimalOdds: parseFloat(e.target.value) })} />
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-400">{editDraft.source}</td>
                      <td className="py-2 pr-2">
                        <select className="input text-xs" value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as OptionStatus })}>
                          {(["ACTIVE", "SUSPENDED", "CLOSED"] as OptionStatus[]).map((s) => (
                            <option key={s} value={s}>{t.optionStatus[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input type="checkbox" checked={editDraft.needsReview} onChange={(e) => setEditDraft({ ...editDraft, needsReview: e.target.checked })} />
                      </td>
                      <td className="py-2">
                        <button type="button" className="text-xs text-emerald-400 mr-2" onClick={saveEdit}>{t.importImage.save}</button>
                        <button type="button" className="text-xs text-slate-400" onClick={() => { setEditingId(null); setEditDraft(null); }}>{t.importImage.cancel}</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-t border-slate-800">
                      <td className="py-2 pr-2 text-slate-300">{t.markets[row.marketType]}</td>
                      <td className="py-2 pr-2 text-white">{row.label}</td>
                      <td className="py-2 pr-2 text-slate-400">{row.line ?? t.common.na}</td>
                      <td className="py-2 pr-2 text-slate-300">{row.decimalOdds} (x{row.multiplier})</td>
                      <td className="py-2 pr-2 text-xs text-slate-500">{row.bookmaker ?? row.source}</td>
                      <td className="py-2 pr-2 text-xs">{t.optionStatus[row.status]}</td>
                      <td className="py-2 pr-2">
                        {row.needsReview ? (
                          <span className="text-xs text-amber-400">{t.importImage.needsReview}</span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <button type="button" className="text-xs text-slate-300 mr-2 hover:underline" onClick={() => startEdit(row)}>{t.importImage.edit}</button>
                        <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => deleteRow(row.id)}>{t.importImage.delete}</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {activePreview.length > 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="btn-primary mt-4 w-full sm:w-auto"
          >
            {importing ? t.importImage.importing : t.importImage.importMarkets}
          </button>
        )}
      </div>
    </div>
  );
}
