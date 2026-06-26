import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrUpdatePick } from "@/lib/points";

const pickSchema = z.object({
  marketOptionId: z.string(),
  pointsRisked: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = pickSchema.parse(body);

    const pick = await createOrUpdatePick({
      userId: session.id,
      marketOptionId: data.marketOptionId,
      pointsRisked: data.pointsRisked,
    });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    return NextResponse.json({ pick, points: user?.points });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pick";
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");

  const picks = await prisma.pick.findMany({
    where: {
      userId: session.id,
      ...(matchId ? { matchId } : {}),
    },
    include: {
      match: true,
      market: true,
      marketOption: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ picks });
}
