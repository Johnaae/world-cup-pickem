import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  closeAllMatchMarkets,
  reopenAllMatchMarkets,
  suspendAllMatchMarkets,
  syncMatchOdds,
} from "@/lib/odds";

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { matchId, action } = body as { matchId?: string; action?: string };

    if (!matchId || !action) {
      return NextResponse.json({ error: "matchId and action required" }, { status: 400 });
    }

    switch (action) {
      case "suspend_all":
        await suspendAllMatchMarkets(matchId);
        return NextResponse.json({ success: true });
      case "close_all":
        await closeAllMatchMarkets(matchId);
        return NextResponse.json({ success: true });
      case "reopen_all":
        await reopenAllMatchMarkets(matchId);
        return NextResponse.json({ success: true });
      case "refresh_odds": {
        const result = await syncMatchOdds(matchId);
        return NextResponse.json({ success: true, ...result });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Can only reopen markets before kickoff") {
        return NextResponse.json({ error: error.message, errorKey: "REOPEN_BEFORE_KICKOFF" }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");
    const marketOptionId = searchParams.get("marketOptionId");

    if (!matchId && !marketOptionId) {
      return NextResponse.json({ error: "matchId or marketOptionId required" }, { status: 400 });
    }

    const history = await prisma.oddsHistory.findMany({
      where: marketOptionId
        ? { marketOptionId }
        : {
            marketOption: { market: { matchId: matchId! } },
          },
      include: {
        marketOption: {
          select: { label: true, market: { select: { type: true, label: true } } },
        },
      },
      orderBy: { changedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
