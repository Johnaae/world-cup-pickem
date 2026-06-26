import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { applyBulkMarketPaste } from "@/lib/odds/applyBulkPaste";

const schema = z.object({
  matchId: z.string().min(1),
  text: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = schema.parse(body);
    const result = await applyBulkMarketPaste(data.matchId, data.text);

    if (result.createdOptions === 0 && result.updatedOptions === 0) {
      return NextResponse.json(
        {
          error: result.errors[0] ?? "No markets were imported. Check your paste format.",
          ...result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${result.createdOptions} new options, updated ${result.updatedOptions}. Source: Manual.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to import markets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
