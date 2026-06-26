import { NextResponse } from "next/server";
import { z } from "zod";
import { MarketType, OptionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { applyImageImport } from "@/lib/ai/applyImageImport";

const previewRowSchema = z.object({
  id: z.string(),
  marketType: z.nativeEnum(MarketType),
  marketLabel: z.string(),
  label: z.string().min(1),
  line: z.number().nullable(),
  decimalOdds: z.number().positive(),
  multiplier: z.number().positive(),
  status: z.nativeEnum(OptionStatus),
  source: z.string(),
  bookmaker: z.string().nullable(),
  needsReview: z.boolean(),
  deleted: z.boolean(),
});

const schema = z.object({
  matchId: z.string().min(1),
  rows: z.array(previewRowSchema).min(1),
  confirmNeedsReview: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = schema.parse(body);

    const result = await applyImageImport({
      matchId: data.matchId,
      rows: data.rows,
      confirmNeedsReview: data.confirmNeedsReview ?? false,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Imported ${result.createdOptions} new options, updated ${result.updatedOptions}. Skipped ${result.skippedNeedsReview} rows needing review.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to import markets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
