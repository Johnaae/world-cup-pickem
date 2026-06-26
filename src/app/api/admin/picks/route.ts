import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { manuallySettlePick } from "@/lib/points";

const settleSchema = z.object({
  pickId: z.string(),
  status: z.enum(["WON", "LOST"]),
});

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = settleSchema.parse(body);
    await manuallySettlePick(data.pickId, data.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to settle pick";
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
