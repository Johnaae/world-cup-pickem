import { NextResponse } from "next/server";
import { z } from "zod";
import { MarketType, OptionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { upsertManualOption } from "@/lib/manualMarkets";

const schema = z.object({
  matchId: z.string().min(1),
  marketType: z.nativeEnum(MarketType),
  label: z.string().min(1),
  outcomeType: z.string().optional(),
  teamName: z.string().nullable().optional(),
  pointLine: z.number().nullable().optional(),
  correctScoreA: z.number().int().nullable().optional(),
  correctScoreB: z.number().int().nullable().optional(),
  multiplier: z.number().positive(),
  status: z.nativeEnum(OptionStatus).optional(),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = schema.parse(body);
    const option = await upsertManualOption(data);
    return NextResponse.json({ success: true, option });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create option";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
