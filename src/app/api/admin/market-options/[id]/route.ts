import { NextResponse } from "next/server";
import { z } from "zod";
import { OptionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateOptionSettlement } from "@/lib/marketSettlement";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  pointLine: z.number().nullable().optional(),
  multiplier: z.number().positive().optional(),
  status: z.nativeEnum(OptionStatus).optional(),
  note: z.string().nullable().optional(),
  settlementResult: z.enum(["WON", "LOST", "UNSETTLED"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.settlementResult) {
      const option = await updateOptionSettlement(id, data.settlementResult);
      return NextResponse.json({ success: true, option });
    }

    const existing = await prisma.marketOption.findUnique({
      where: { id },
      include: { market: true },
    });
    if (!existing) throw new Error("Option not found");
    if (existing.market.settledAt) {
      throw new Error("Market is settled — cannot edit options");
    }

    if (data.multiplier !== undefined && data.multiplier !== existing.multiplier) {
      await prisma.oddsHistory.create({
        data: {
          marketOptionId: id,
          oldMultiplier: existing.multiplier,
          newMultiplier: data.multiplier,
          source: existing.provider,
          note: "Admin edit",
        },
      });
    }

    const option = await prisma.marketOption.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.pointLine !== undefined ? { pointLine: data.pointLine } : {}),
        ...(data.multiplier !== undefined ? { multiplier: data.multiplier } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    });

    return NextResponse.json({ success: true, option });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update option";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.marketOption.findUnique({
      where: { id },
      include: { market: true, picks: { where: { status: "PENDING" } } },
    });
    if (!existing) throw new Error("Option not found");
    if (existing.picks.length > 0) {
      throw new Error("Cannot delete option with pending picks — suspend or close instead");
    }
    if (existing.market.settledAt) {
      throw new Error("Market is settled — cannot delete options");
    }

    await prisma.marketOption.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete option";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
