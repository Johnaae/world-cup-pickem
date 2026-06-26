"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick as UserPick } from "@prisma/client";
import type { MarketType } from "@/lib/markets";
import { MatchCard } from "@/components/MatchCard";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/LeaderboardTable";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";

type DashboardClientProps = {
  userName: string;
  userPoints: number;
  userId: string;
  upcomingMatches: (Match & {
    markets: (Market & { options: MarketOption[] })[];
    picks: UserPick[];
  })[];
  activePicks: (UserPick & {
    match: Match;
    market: Market | null;
    marketOption: MarketOption | null;
  })[];
  recentResults: (Match & {
    markets: (Market & { options: MarketOption[] })[];
    picks: UserPick[];
  })[];
  leaderboard: LeaderboardEntry[];
};

export function DashboardClient({
  userName,
  userPoints,
  userId,
  upcomingMatches,
  activePicks,
  recentResults,
  leaderboard,
}: DashboardClientProps) {
  const { t, locale, fmt } = useI18n();
  const dateLocale = getDateFnsLocale(locale);

  function pickLabel(pick: DashboardClientProps["activePicks"][0]) {
    const marketName = pick.market
      ? t.markets[pick.market.type as MarketType]
      : t.dashboard.pick;
    const option =
      pick.marketOption?.label ??
      (pick.selectedOutcome === "TEAM_A"
        ? pick.match.teamA
        : pick.selectedOutcome === "TEAM_B"
          ? pick.match.teamB
          : t.outcomes.draw);
    return `${marketName} · ${option} · ${pick.pointsRisked} ${t.nav.points}`;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{fmt(t.dashboard.greeting, { name: userName })}</h1>
          <p className="text-slate-400">{t.dashboard.subtitle}</p>
        </div>
        <div className="card !py-3 !px-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t.dashboard.yourPoints}</p>
          <p className="text-3xl font-black text-emerald-400">{userPoints.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title !mb-0">{t.dashboard.upcomingMatches}</h2>
            <Link href="/matches" className="text-sm text-emerald-400 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-slate-400">{t.dashboard.noUpcoming}</p>
          ) : (
            <div className="grid gap-4">
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} showPickButton={false} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title">{t.dashboard.activePicks}</h2>
          {activePicks.length === 0 ? (
            <p className="text-slate-400">
              {t.dashboard.noActivePicks}{" "}
              <Link href="/matches" className="text-emerald-400 hover:underline">{t.dashboard.makeOne}</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {activePicks.map((pick) => (
                <div key={pick.id} className="card !p-4">
                  <p className="font-semibold text-white">
                    {pick.match.teamA} vs {pick.match.teamB}
                  </p>
                  <p className="text-sm text-amber-400 mt-1">{pickLabel(pick)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {format(new Date(pick.match.startTime), "PPp", { locale: dateLocale })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="section-title">{t.dashboard.recentResults}</h2>
        {recentResults.length === 0 ? (
          <p className="text-slate-400">{t.dashboard.noResults}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {recentResults.map((match) => (
              <MatchCard key={match.id} match={match} showPickButton={false} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title !mb-0">{t.dashboard.leaderboardPreview}</h2>
          <Link href="/leaderboard" className="text-sm text-emerald-400 hover:underline">{t.dashboard.fullBoard}</Link>
        </div>
        <LeaderboardTable entries={leaderboard} highlightUserId={userId} compact />
      </section>
    </main>
  );
}
