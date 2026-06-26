import { NextResponse } from "next/server";
import { z } from "zod";
import { MatchStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.string().min(1),
  scoreA: z.number().int().min(0).nullable(),
  scoreB: z.number().int().min(0).nullable(),
  status: z.nativeEnum(MatchStatus),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[quick-score] Invalid JSON:", parseError);
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }

    const data = schema.parse(body);

    const match = await prisma.match.update({
      where: { id: data.id },
      data: {
        scoreA: data.scoreA,
        scoreB: data.scoreB,
        status: data.status,
      },
    });

    return NextResponse.json({ ok: true, match });
  } catch (error) {
    console.error("[quick-score] Failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Failed to save score" }, { status: 500 });
  }
}
