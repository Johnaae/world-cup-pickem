import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  startingPoints: z.number().int().positive().optional(),
  disclaimer: z.string().min(10).optional(),
  inviteCode: z.string().min(3).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = settingsSchema.parse(body);

    const settings = await prisma.appSettings.upsert({
      where: { id: "default" },
      update: data,
      create: {
        id: "default",
        startingPoints: data.startingPoints ?? 1000,
        disclaimer: data.disclaimer ?? "",
        inviteCode: data.inviteCode ?? "WORLDCUP2026",
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
