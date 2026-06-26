import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { settleMarketByOptions } from "@/lib/marketSettlement";

const schema = z.object({
  marketId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = schema.parse(body);
    const result = await settleMarketByOptions(data.marketId);
    return NextResponse.json({
      success: true,
      message: `Market settled. ${result.settledPicks} pick(s) processed. Virtual points only.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to settle market";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
