import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/LeaderboardTable";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      points: true,
      picks: { select: { status: true, pointsRisked: true, pointsWon: true } },
    },
    orderBy: { points: "desc" },
  });

  const leaderboard: LeaderboardEntry[] = users.map((user, index) => {
    const totalPicks = user.picks.length;
    const correctPicks = user.picks.filter((p) => p.status === "WON").length;
    const resolved = user.picks.filter((p) => p.status === "WON" || p.status === "LOST");
    const wins = user.picks.filter((p) => p.status === "WON" && p.pointsWon).map((p) => p.pointsWon!);
    const losses = user.picks.filter((p) => p.status === "LOST").map((p) => -p.pointsRisked);

    return {
      rank: index + 1,
      id: user.id,
      name: user.name,
      points: user.points,
      totalPicks,
      correctPicks,
      winRate: resolved.length ? Math.round((correctPicks / resolved.length) * 1000) / 10 : 0,
      biggestWin: wins.length ? Math.max(...wins) : 0,
      biggestLoss: losses.length ? Math.min(...losses) : 0,
    };
  });

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black text-white">🏆 Leaderboard</h1>
          <p className="mt-2 text-slate-400">Virtual points only — for fun and bragging rights!</p>
        </div>
        <LeaderboardTable entries={leaderboard} highlightUserId={session.id} />
      </main>
    </div>
  );
}
