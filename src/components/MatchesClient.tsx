"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MatchCard } from "./MatchCard";
import { PickModal, type MatchWithMarkets } from "./PickModal";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";
import { getMatchLastSyncedAt } from "@/lib/odds/staleness";

type MatchesClientProps = {
  initialMatches: MatchWithMarkets[];
  userPoints: number;
};

export function MatchesClient({ initialMatches, userPoints }: MatchesClientProps) {
  const { t, locale } = useI18n();
  const dateLocale = getDateFnsLocale(locale);
  const [matches, setMatches] = useState(initialMatches);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithMarkets | null>(null);
  const [points, setPoints] = useState(userPoints);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    const res = await fetch("/api/matches");
    const data = await res.json();
    setMatches(data.matches);
    setLastRefreshedAt(new Date());
    const sessionRes = await fetch("/api/auth/session");
    const sessionData = await sessionRes.json();
    if (sessionData.user) setPoints(sessionData.user.points);
  }, []);

  const hasLive = matches.some((m) => m.status === "LIVE");
  const hasUpcoming = matches.some((m) => m.status === "UPCOMING");
  const refreshInterval = hasLive ? 30_000 : hasUpcoming ? 120_000 : null;

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, refresh]);

  useEffect(() => {
    if (!selectedMatch) return;
    const updated = matches.find((m) => m.id === selectedMatch.id);
    if (updated) setSelectedMatch(updated);
  }, [matches, selectedMatch?.id]);

  const globalLastSynced = useMemo(() => {
    let latest: Date | null = null;
    for (const m of matches) {
      const allOptions = m.markets.flatMap((mk) => mk.options);
      const t = getMatchLastSyncedAt(allOptions);
      if (t && (!latest || t > latest)) latest = t;
    }
    return latest;
  }, [matches]);

  const upcoming = matches.filter((m) => m.status === "UPCOMING" || m.status === "LIVE");
  const finished = matches.filter((m) => m.status === "FINISHED");

  return (
    <>
      {(hasLive || hasUpcoming) && (
        <p className="text-xs text-slate-500 mb-4">
          {t.pick.lastUpdated}:{" "}
          {format(lastRefreshedAt, "HH:mm:ss", { locale: dateLocale })}
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
              <MatchCard key={match.id} match={match} onPick={() => setSelectedMatch(match)} />
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
              <MatchCard key={match.id} match={match} showPickButton={false} />
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
          onSuccess={refresh}
        />
      )}
    </>
  );
}
