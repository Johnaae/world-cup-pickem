import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const matches = await prisma.match.findMany({
      orderBy: { startTime: "asc" },
      include: {
        markets: {
          include: { options: { orderBy: { multiplier: "asc" } } },
          orderBy: { type: "asc" },
        },
        picks: {
          where: { userId: session.id },
          include: { market: true, marketOption: true },
        },
      },
    });

    return NextResponse.json({ ok: true, matches });
  } catch (error) {
    console.error("[GET /api/matches] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load matches" },
      { status: 500 }
    );
  }
}
