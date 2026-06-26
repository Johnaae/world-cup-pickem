import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { DashboardClient } from "@/components/DashboardClient";
import type { LeaderboardEntry } from "@/components/LeaderboardTable";

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
      <DashboardClient
        userName={session.name}
        userPoints={user?.points ?? 0}
        userId={session.id}
        upcomingMatches={upcomingMatches}
        activePicks={activePicks}
        recentResults={recentResults}
        leaderboard={leaderboard}
      />
    </div>
  );
}
