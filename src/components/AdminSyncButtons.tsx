"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";

type SyncMode = "matches" | "odds" | "all";

export function AdminSyncButtons({
  matchId,
  lastSyncedAt: initialSyncedAt,
  onSynced,
  compact = false,
}: {
  matchId?: string;
  lastSyncedAt?: string | null;
  onSynced?: () => void;
  compact?: boolean;
}) {
  const { t, locale, te } = useI18n();
  const dateLocale = getDateFnsLocale(locale);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt ?? null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function runSync(mode: SyncMode) {
    setSyncing(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ mode });
      if (matchId) params.set("matchId", matchId);
      const res = await fetch(`/api/admin/sync-odds?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? te(data.error) : t.admin.syncFailed);
      setSyncedAt(data.lastSyncedAt ?? new Date().toISOString());
      setMessage(t.admin.syncSuccess);
      setMessageType("success");
      onSynced?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.admin.syncFailed);
      setMessageType("error");
    } finally {
      setSyncing(false);
    }
  }

  async function refreshMatchOdds() {
    if (!matchId) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/match-markets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action: "refresh_odds" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? te(data.error) : t.admin.syncFailed);
      setSyncedAt(data.lastSyncedAt ?? new Date().toISOString());
      setMessage(t.admin.refreshOddsSuccess);
      setMessageType("success");
      onSynced?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.admin.syncFailed);
      setMessageType("error");
    } finally {
      setSyncing(false);
    }
  }

  if (compact && matchId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runSync("odds")}
          disabled={syncing}
          className="btn-secondary text-sm"
        >
          {syncing ? t.admin.syncing : t.admin.syncMatchOdds}
        </button>
        <button
          type="button"
          onClick={refreshMatchOdds}
          disabled={syncing}
          className="btn-primary text-sm"
        >
          {syncing ? t.admin.syncing : t.admin.refreshOdds}
        </button>
        {message && (
          <span className={`text-xs ${messageType === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => runSync("matches")} disabled={syncing} className="btn-secondary">
          {syncing ? t.admin.syncing : t.admin.syncMatches}
        </button>
        <button onClick={() => runSync("odds")} disabled={syncing} className="btn-secondary">
          {syncing ? t.admin.syncing : t.admin.syncOdds}
        </button>
        <button onClick={() => runSync("all")} disabled={syncing} className="btn-primary">
          {syncing ? t.admin.syncing : t.admin.syncAll}
        </button>
        {matchId && (
          <button onClick={refreshMatchOdds} disabled={syncing} className="btn-secondary">
            {syncing ? t.admin.syncing : t.admin.refreshOdds}
          </button>
        )}
        <span className="text-sm text-slate-400">
          {t.admin.lastSynced}:{" "}
          {syncedAt ? format(new Date(syncedAt), "PPp", { locale: dateLocale }) : t.admin.neverSynced}
        </span>
      </div>
      {message && (
        <p className={`text-sm ${messageType === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
