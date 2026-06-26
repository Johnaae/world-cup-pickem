import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { OddsProviderError, syncMarkets } from "@/lib/odds";
import type { SyncMode } from "@/lib/odds";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") as SyncMode) || "all";
    const matchId = searchParams.get("matchId") ?? undefined;
    const overwriteManual = searchParams.get("overwriteManual") === "true";

    const result = await syncMarkets({
      mode: mode === "matches" || mode === "odds" ? mode : "all",
      matchId,
      overwriteManual,
    });

    return NextResponse.json({
      success: true,
      message: "Sync completed.",
      ...result,
    });
  } catch (error) {
    if (error instanceof OddsProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to sync." }, { status: 500 });
  }
}
