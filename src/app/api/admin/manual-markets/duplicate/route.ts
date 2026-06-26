import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { duplicateMarketToMatch } from "@/lib/manualMarkets";

const schema = z.object({
  sourceMarketId: z.string().min(1),
  targetMatchId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = schema.parse(body);
    const market = await duplicateMarketToMatch(data.sourceMarketId, data.targetMatchId);
    return NextResponse.json({ success: true, market });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to duplicate market";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
