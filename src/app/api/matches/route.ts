import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await prisma.match.findMany({
    orderBy: { startTime: "asc" },
    include: {
      picks: {
        where: { userId: session.id },
        take: 1,
      },
      _count: { select: { picks: true } },
    },
  });

  return NextResponse.json({ matches });
}
