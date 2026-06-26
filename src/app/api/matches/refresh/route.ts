import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OddsProviderError, syncMatchOdds, markStaleApiOptions } from "@/lib/odds";

const schema = z.object({
  matchId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { matchId } = schema.parse(body);

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "LIVE" && match.status !== "UPCOMING") {
      return NextResponse.json({ error: "MATCH_FINISHED" }, { status: 400 });
    }

    await syncMatchOdds(matchId);
    await markStaleApiOptions();

    const updated = await prisma.match.findUnique({
      where: { id: matchId },
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

    return NextResponse.json({ match: updated, lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof OddsProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to refresh odds" }, { status: 500 });
  }
}
