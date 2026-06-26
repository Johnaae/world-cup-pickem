import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchOddsApiEvents, OddsApiError, syncMatchesFromOddsApi } from "@/lib/odds-api";

export async function GET() {
  try {
    await requireAdmin();

    const { events, requestsRemaining } = await fetchOddsApiEvents();
    const result = await syncMatchesFromOddsApi(events);

    return NextResponse.json({
      success: true,
      message: "Matches and multipliers synced successfully.",
      ...result,
      requestsRemaining,
    });
  } catch (error) {
    if (error instanceof OddsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to sync matches and multipliers." },
      { status: 500 }
    );
  }
}
