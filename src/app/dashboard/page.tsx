import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { MatchCard } from "@/components/MatchCard";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/LeaderboardTable";
import { MARKET_TYPE_LABELS, type MarketType } from "@/lib/markets";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      picks: {
        include: { match: true, market: true, marketOption: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  const upcomingMatches = await prisma.match.findMany({
    where: { status: { in: ["UPCOMING", "LIVE"] } },
    orderBy: { startTime: "asc" },
    take: 4,
    include: {
      markets: { include: { options: true } },
      picks: { where: { userId: session.id }, include: { market: true, marketOption: true } },
    },
  });

  const recentResults = await prisma.match.findMany({
    where: { status: "FINISHED" },
    orderBy: { startTime: "desc" },
    take: 3,
    include: {
      markets: { include: { options: true } },
      picks: { where: { userId: session.id }, include: { market: true, marketOption: true } },
    },
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      points: true,
      picks: { select: { status: true, pointsRisked: true, pointsWon: true } },
    },
    orderBy: { points: "desc" },
    take: 5,
  });

  const leaderboard: LeaderboardEntry[] = users.map((u, i) => {
    const resolved = u.picks.filter((p) => p.status === "WON" || p.status === "LOST");
    const correct = u.picks.filter((p) => p.status === "WON").length;
    return {
      rank: i + 1,
      id: u.id,
      name: u.name,
      points: u.points,
      totalPicks: u.picks.length,
      correctPicks: correct,
      winRate: resolved.length ? Math.round((correct / resolved.length) * 1000) / 10 : 0,
      biggestWin: Math.max(0, ...u.picks.filter((p) => p.pointsWon && p.pointsWon > 0).map((p) => p.pointsWon!)),
      biggestLoss: Math.min(0, ...u.picks.filter((p) => p.status === "LOST").map((p) => -p.pointsRisked)),
    };
  });

  const activePicks = user?.picks.filter((p) => p.status === "PENDING") ?? [];

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Hey, {session.name}!</h1>
            <p className="text-slate-400">Ready to make your picks?</p>
          </div>
          <div className="card !py-3 !px-6 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Your Points</p>
            <p className="text-3xl font-black text-emerald-400">{user?.points.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title !mb-0">Upcoming Matches</h2>
              <Link href="/matches" className="text-sm text-emerald-400 hover:underline">View all</Link>
            </div>
            {upcomingMatches.length === 0 ? (
              <p className="text-slate-400">No upcoming matches.</p>
            ) : (
              <div className="grid gap-4">
                {upcomingMatches.map((match) => (
                  <MatchCard key={match.id} match={match} showPickButton={false} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-title">Active Picks</h2>
            {activePicks.length === 0 ? (
              <p className="text-slate-400">No active picks. <Link href="/matches" className="text-emerald-400 hover:underline">Make one!</Link></p>
            ) : (
              <div className="space-y-3">
                {activePicks.map((pick) => (
                  <div key={pick.id} className="card !p-4">
                    <p className="font-semibold text-white">
                      {pick.match.teamA} vs {pick.match.teamB}
                    </p>
                    <p className="text-sm text-amber-400 mt-1">
                      {pick.market
                        ? MARKET_TYPE_LABELS[pick.market.type as MarketType]
                        : "Pick"}
                      {" · "}
                      {pick.marketOption?.label ??
                        (pick.selectedOutcome === "TEAM_A"
                          ? pick.match.teamA
                          : pick.selectedOutcome === "TEAM_B"
                            ? pick.match.teamB
                            : "Draw")}{" "}
                      · {pick.pointsRisked} pts
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(pick.match.startTime), "PPp")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-8">
          <h2 className="section-title">Recent Results</h2>
          {recentResults.length === 0 ? (
            <p className="text-slate-400">No results yet.</p>
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
            <h2 className="section-title !mb-0">Leaderboard Preview</h2>
            <Link href="/leaderboard" className="text-sm text-emerald-400 hover:underline">Full board</Link>
          </div>
          <LeaderboardTable entries={leaderboard} highlightUserId={session.id} compact />
        </section>
      </main>
    </div>
  );
}
