import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    const matches = await prisma.match.findMany({
      where: matchId
        ? { id: matchId }
        : { status: { in: ["UPCOMING", "LIVE"] } },
      orderBy: { startTime: "asc" },
      include: {
        markets: {
          include: { options: { orderBy: { label: "asc" } } },
          orderBy: { type: "asc" },
        },
      },
    });

    return NextResponse.json({ matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load markets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
