import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      points: true,
      picks: {
        select: {
          status: true,
          pointsRisked: true,
          pointsWon: true,
        },
      },
    },
    orderBy: { points: "desc" },
  });

  const leaderboard = users.map((user, index) => {
    const totalPicks = user.picks.length;
    const resolvedPicks = user.picks.filter((p) => p.status === "WON" || p.status === "LOST");
    const correctPicks = user.picks.filter((p) => p.status === "WON").length;
    const winRate = resolvedPicks.length > 0 ? (correctPicks / resolvedPicks.length) * 100 : 0;

    const wins = user.picks
      .filter((p) => p.status === "WON" && p.pointsWon !== null)
      .map((p) => p.pointsWon!);
    const losses = user.picks
      .filter((p) => p.status === "LOST")
      .map((p) => -p.pointsRisked);

    return {
      rank: index + 1,
      id: user.id,
      name: user.name,
      points: user.points,
      totalPicks,
      correctPicks,
      winRate: Math.round(winRate * 10) / 10,
      biggestWin: wins.length > 0 ? Math.max(...wins) : 0,
      biggestLoss: losses.length > 0 ? Math.min(...losses) : 0,
    };
  });

  return NextResponse.json({ leaderboard });
}
