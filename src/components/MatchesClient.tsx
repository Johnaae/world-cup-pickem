"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MatchCard } from "./MatchCard";
import { PickModal, type MatchWithMarkets } from "./PickModal";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";
import { getMatchLastSyncedAt } from "@/lib/odds/staleness";

type RefreshResult = { ok: boolean; error?: string; message?: string };

type MatchesClientProps = {
  initialMatches: MatchWithMarkets[];
  userPoints: number;
  isAdmin?: boolean;
};

export function MatchesClient({ initialMatches, userPoints, isAdmin = false }: MatchesClientProps) {
  const { t, locale, te } = useI18n();
  const dateLocale = getDateFnsLocale(locale);
  const [matches, setMatches] = useState(initialMatches);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithMarkets | null>(null);
  const [points, setPoints] = useState(userPoints);
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");

  const reloadMatches = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/matches");
      let data: { ok?: boolean; matches?: MatchWithMarkets[]; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setPageError(t.common.somethingWrong);
        return false;
      }

      if (!res.ok || data.ok === false) {
        setPageError(data.error ? te(data.error) : t.common.failed);
        return false;
      }

      if (data.matches) setMatches(data.matches);
      setLastManualRefreshAt(new Date());
      setPageError("");

      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.user) setPoints(sessionData.user.points);
        }
      } catch {
        // non-fatal
      }

      return true;
    } catch (err) {
      console.error("[MatchesClient] reloadMatches failed:", err);
      setPageError(err instanceof Error ? err.message : t.common.somethingWrong);
      return false;
    }
  }, [t, te]);

  const refreshOddsForMatch = useCallback(
    async (matchId: string): Promise<RefreshResult> => {
      try {
        const res = await fetch("/api/admin/sync-match-odds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });

        let data: { ok?: boolean; error?: string; message?: string } = {};
        try {
          data = await res.json();
        } catch {
          return { ok: false, error: t.common.somethingWrong };
        }

        if (!data.ok) {
          const errText = data.error ? te(data.error) : t.common.failed;
          return { ok: false, error: errText };
        }

        await reloadMatches();
        const toastMsg = data.message ?? t.matches.oddsRefreshed;
        setToast(toastMsg);
        return { ok: true, message: toastMsg };
      } catch (err) {
        console.error("[MatchesClient] refreshOddsForMatch failed:", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : t.common.somethingWrong,
        };
      }
    },
    [reloadMatches, t, te]
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!selectedMatch) return;
    try {
      const updated = matches.find((m) => m.id === selectedMatch.id);
      if (updated) setSelectedMatch(updated);
    } catch (err) {
      console.error("[MatchesClient] sync selected match failed:", err);
    }
  }, [matches, selectedMatch?.id]);

  const globalLastSynced = useMemo(() => {
    try {
      let latest: Date | null = null;
      for (const m of matches) {
        const allOptions = m.markets.flatMap((mk) => mk.options);
        const synced = getMatchLastSyncedAt(allOptions);
        if (synced && (!latest || synced > latest)) latest = synced;
      }
      return latest;
    } catch {
      return null;
    }
  }, [matches]);

  const upcoming = matches.filter((m) => m.status === "UPCOMING" || m.status === "LIVE");
  const finished = matches.filter((m) => m.status === "FINISHED");

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-300 shadow-lg">
          {toast}
        </div>
      )}

      {pageError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {pageError}
        </div>
      )}

      {lastManualRefreshAt && (
        <p className="text-xs text-slate-500 mb-4">
          {t.pick.lastUpdated}: {format(lastManualRefreshAt, "HH:mm:ss", { locale: dateLocale })}
          {globalLastSynced && (
            <>
              {" · "}
              {t.pick.oddsSyncedAt}: {format(globalLastSynced, "HH:mm:ss", { locale: dateLocale })}
            </>
          )}
        </p>
      )}

      <section className="mb-8">
        <h2 className="section-title">{t.matches.upcomingLive}</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-400">{t.matches.noUpcoming}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                isAdmin={isAdmin}
                onPick={() => setSelectedMatch(match)}
                onRefreshOdds={refreshOddsForMatch}
                onScoreSaved={reloadMatches}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">{t.matches.results}</h2>
        {finished.length === 0 ? (
          <p className="text-slate-400">{t.matches.noFinished}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {finished.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                isAdmin={isAdmin}
                showPickButton={false}
                onScoreSaved={reloadMatches}
              />
            ))}
          </div>
        )}
      </section>

      {selectedMatch && (
        <PickModal
          match={selectedMatch}
          userPoints={points}
          userPicks={selectedMatch.picks ?? []}
          onClose={() => setSelectedMatch(null)}
          onSuccess={reloadMatches}
        />
      )}
    </>
  );
}
