import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      select: {
        name: true,
        points: true,
        picks: {
          select: { status: true, pointsRisked: true, pointsWon: true },
        },
      },
      orderBy: { points: "desc" },
    });

    const rows = users.map((user, index) => {
      const totalPicks = user.picks.length;
      const correctPicks = user.picks.filter((p) => p.status === "WON").length;
      const resolved = user.picks.filter((p) => p.status === "WON" || p.status === "LOST");
      const winRate = resolved.length > 0 ? ((correctPicks / resolved.length) * 100).toFixed(1) : "0";
      const wins = user.picks.filter((p) => p.status === "WON" && p.pointsWon).map((p) => p.pointsWon!);
      const losses = user.picks.filter((p) => p.status === "LOST").map((p) => -p.pointsRisked);

      return {
        rank: index + 1,
        name: user.name,
        points: user.points,
        totalPicks,
        correctPicks,
        winRate: `${winRate}%`,
        biggestWin: wins.length ? Math.max(...wins) : 0,
        biggestLoss: losses.length ? Math.min(...losses) : 0,
      };
    });

    const headers = ["Rank", "Name", "Points", "Total Picks", "Correct Picks", "Win Rate", "Biggest Win", "Biggest Loss"];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [r.rank, `"${r.name}"`, r.points, r.totalPicks, r.correctPicks, r.winRate, r.biggestWin, r.biggestLoss].join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="leaderboard.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
