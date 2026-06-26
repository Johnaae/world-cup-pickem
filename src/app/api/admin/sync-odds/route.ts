import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { OddsProviderError, syncAllMarkets } from "@/lib/odds";

export async function GET() {
  try {
    await requireAdmin();
    const result = await syncAllMarkets();

    return NextResponse.json({
      success: true,
      message: "Matches and multipliers synced successfully.",
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
    return NextResponse.json(
      { error: "Failed to sync matches and multipliers." },
      { status: 500 }
    );
  }
}
