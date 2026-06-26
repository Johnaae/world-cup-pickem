import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetAllUserPoints, settleMatch } from "@/lib/points";
import { MatchStatus } from "@prisma/client";
import { getAppSettings } from "@/lib/settings";

const matchSchema = z.object({
  teamA: z.string().min(1),
  teamB: z.string().min(1),
  startTime: z.string(),
  status: z.enum(["UPCOMING", "LIVE", "FINISHED"]).optional(),
  scoreA: z.number().int().min(0).nullable().optional(),
  scoreB: z.number().int().min(0).nullable().optional(),
  multiplierTeamA: z.number().positive().optional(),
  multiplierDraw: z.number().positive().optional(),
  multiplierTeamB: z.number().positive().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const matches = await prisma.match.findMany({
      orderBy: { startTime: "asc" },
      include: {
        picks: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = matchSchema.parse(body);

    const match = await prisma.match.create({
      data: {
        teamA: data.teamA,
        teamB: data.teamB,
        startTime: new Date(data.startTime),
        status: (data.status as MatchStatus) || MatchStatus.UPCOMING,
        scoreA: data.scoreA ?? null,
        scoreB: data.scoreB ?? null,
        multiplierTeamA: data.multiplierTeamA ?? 1.5,
        multiplierDraw: data.multiplierDraw ?? 3.0,
        multiplierTeamB: data.multiplierTeamB ?? 2.5,
      },
    });

    return NextResponse.json({ match });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, settle, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: "Match ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (rest.teamA) updateData.teamA = rest.teamA;
    if (rest.teamB) updateData.teamB = rest.teamB;
    if (rest.startTime) updateData.startTime = new Date(rest.startTime);
    if (rest.status) updateData.status = rest.status;
    if (rest.scoreA !== undefined) updateData.scoreA = rest.scoreA;
    if (rest.scoreB !== undefined) updateData.scoreB = rest.scoreB;
    if (rest.multiplierTeamA) updateData.multiplierTeamA = rest.multiplierTeamA;
    if (rest.multiplierDraw) updateData.multiplierDraw = rest.multiplierDraw;
    if (rest.multiplierTeamB) updateData.multiplierTeamB = rest.multiplierTeamB;

    const match = await prisma.match.update({
      where: { id },
      data: updateData,
    });

    if (settle) {
      await settleMatch(id);
    }

    return NextResponse.json({ match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update match";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Match ID required" }, { status: 400 });
    }

    await prisma.match.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete match" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const action = body.action;

    if (action === "reset_points") {
      const settings = await getAppSettings();
      await resetAllUserPoints(settings.startingPoints);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
