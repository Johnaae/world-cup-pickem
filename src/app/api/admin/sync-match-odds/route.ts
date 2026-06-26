import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OddsProviderError, syncMatchOdds } from "@/lib/odds";

const schema = z.object({
  matchId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[sync-match-odds] Invalid JSON body:", parseError);
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }

    const { matchId } = schema.parse(body);

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "LIVE" && match.status !== "UPCOMING") {
      return NextResponse.json({ ok: false, error: "MATCH_FINISHED" }, { status: 400 });
    }

    try {
      await syncMatchOdds(matchId);
    } catch (syncError) {
      console.error("[sync-match-odds] sync failed:", syncError);
      if (syncError instanceof OddsProviderError) {
        const errorKey =
          syncError.message === "API_NO_LIVE_ODDS" ? "API_NO_LIVE_ODDS" : syncError.message;
        return NextResponse.json({ ok: false, error: errorKey });
      }
      throw syncError;
    }

    return NextResponse.json({
      ok: true,
      message: "Đã làm mới kèo",
      matchId,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[sync-match-odds] Failed:", error);

    if (error instanceof OddsProviderError) {
      const errorKey = error.message === "API_NO_LIVE_ODDS" ? "API_NO_LIVE_ODDS" : error.message;
      return NextResponse.json({ ok: false, error: errorKey }, { status: 200 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 200 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to refresh odds";
    return NextResponse.json({ ok: false, error: message });
  }
}
