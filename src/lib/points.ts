import {
  MatchStatus,
  PickOutcome,
  PickStatus,
  TransactionType,
  type Match,
  type Pick as UserPick,
} from "@prisma/client";
import { prisma } from "./prisma";

export function getMultiplierForOutcome(
  match: Pick<Match, "multiplierTeamA" | "multiplierDraw" | "multiplierTeamB">,
  outcome: PickOutcome
): number {
  switch (outcome) {
    case "TEAM_A":
      return match.multiplierTeamA;
    case "DRAW":
      return match.multiplierDraw;
    case "TEAM_B":
      return match.multiplierTeamB;
  }
}

export function getMatchResultOutcome(
  scoreA: number,
  scoreB: number
): PickOutcome {
  if (scoreA > scoreB) return "TEAM_A";
  if (scoreA < scoreB) return "TEAM_B";
  return "DRAW";
}

export function calculateWinAmount(pointsRisked: number, multiplier: number) {
  const profit = Math.round(pointsRisked * multiplier);
  const totalReturn = pointsRisked + profit;
  return { profit, totalReturn };
}

export function isMatchLocked(match: Pick<Match, "startTime" | "status">) {
  const now = new Date();
  return match.status !== "UPCOMING" || match.startTime <= now;
}

async function addTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    userId: string;
    pickId?: string;
    type: TransactionType;
    amount: number;
    note?: string;
  }
) {
  const user = await tx.user.update({
    where: { id: params.userId },
    data: { points: { increment: params.amount } },
  });

  await tx.pointsTransaction.create({
    data: {
      userId: params.userId,
      pickId: params.pickId,
      type: params.type,
      amount: params.amount,
      balanceAfter: user.points,
      note: params.note,
    },
  });

  return user.points;
}

export async function createOrUpdatePick(params: {
  userId: string;
  matchId: string;
  outcome: PickOutcome;
  pointsRisked: number;
}) {
  const match = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!match) throw new Error("Match not found");
  if (isMatchLocked(match)) throw new Error("Match has already started");

  const multiplier = getMultiplierForOutcome(match, params.outcome);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new Error("User not found");

    const existingPick = await tx.pick.findUnique({
      where: {
        userId_matchId: { userId: params.userId, matchId: params.matchId },
      },
    });

    if (existingPick) {
      if (existingPick.status !== "PENDING") {
        throw new Error("Cannot edit a resolved pick");
      }

      const pointsDiff = params.pointsRisked - existingPick.pointsRisked;
      if (pointsDiff > 0 && user.points < pointsDiff) {
        throw new Error("Insufficient points");
      }

      if (pointsDiff !== 0) {
        if (pointsDiff > 0) {
          await addTransaction(tx, {
            userId: params.userId,
            pickId: existingPick.id,
            type: TransactionType.RISK,
            amount: -pointsDiff,
            note: `Increased risk on pick`,
          });
        } else {
          await addTransaction(tx, {
            userId: params.userId,
            pickId: existingPick.id,
            type: TransactionType.REFUND,
            amount: -pointsDiff,
            note: `Reduced risk on pick`,
          });
        }
      }

      return tx.pick.update({
        where: { id: existingPick.id },
        data: {
          selectedOutcome: params.outcome,
          pointsRisked: params.pointsRisked,
          multiplier,
        },
      });
    }

    if (user.points < params.pointsRisked) {
      throw new Error("Insufficient points");
    }

    const pick = await tx.pick.create({
      data: {
        userId: params.userId,
        matchId: params.matchId,
        selectedOutcome: params.outcome,
        pointsRisked: params.pointsRisked,
        multiplier,
        status: PickStatus.PENDING,
      },
    });

    await addTransaction(tx, {
      userId: params.userId,
      pickId: pick.id,
      type: TransactionType.RISK,
      amount: -params.pointsRisked,
      note: `Risked on ${match.teamA} vs ${match.teamB}`,
    });

    return pick;
  });
}

async function reversePickResolution(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pick: UserPick
) {
  if (pick.status === PickStatus.WON) {
    const { totalReturn } = calculateWinAmount(pick.pointsRisked, pick.multiplier);
    await addTransaction(tx, {
      userId: pick.userId,
      pickId: pick.id,
      type: TransactionType.ADMIN_ADJUSTMENT,
      amount: -totalReturn,
      note: "Reversed win for result recalculation",
    });
  }

  await tx.pick.update({
    where: { id: pick.id },
    data: { status: PickStatus.PENDING, pointsWon: null },
  });
}

async function resolvePick(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pick: UserPick,
  winningOutcome: PickOutcome
) {
  if (pick.selectedOutcome === winningOutcome) {
    const { profit, totalReturn } = calculateWinAmount(
      pick.pointsRisked,
      pick.multiplier
    );
    await addTransaction(tx, {
      userId: pick.userId,
      pickId: pick.id,
      type: TransactionType.WIN,
      amount: totalReturn,
      note: `Won pick (+${profit} profit)`,
    });
    await tx.pick.update({
      where: { id: pick.id },
      data: { status: PickStatus.WON, pointsWon: profit },
    });
  } else {
    await tx.pointsTransaction.create({
      data: {
        userId: pick.userId,
        pickId: pick.id,
        type: TransactionType.LOSS,
        amount: 0,
        balanceAfter: (
          await tx.user.findUnique({ where: { id: pick.userId } })
        )!.points,
        note: `Lost pick (-${pick.pointsRisked} risked)`,
      },
    });
    await tx.pick.update({
      where: { id: pick.id },
      data: { status: PickStatus.LOST, pointsWon: -pick.pointsRisked },
    });
  }
}

export async function settleMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (match.scoreA === null || match.scoreB === null) {
    throw new Error("Match scores are required");
  }

  const winningOutcome = getMatchResultOutcome(match.scoreA, match.scoreB);

  return prisma.$transaction(async (tx) => {
    const picks = await tx.pick.findMany({
      where: { matchId, status: { in: [PickStatus.PENDING, PickStatus.WON, PickStatus.LOST] } },
    });

    for (const pick of picks) {
      if (pick.status === PickStatus.WON || pick.status === PickStatus.LOST) {
        await reversePickResolution(tx, pick);
      }
    }

    const pendingPicks = await tx.pick.findMany({
      where: { matchId, status: PickStatus.PENDING },
    });

    for (const pick of pendingPicks) {
      await resolvePick(tx, pick, winningOutcome);
    }

    await tx.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.FINISHED },
    });
  });
}

export async function resetAllUserPoints(startingPoints: number) {
  return prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany();
    for (const user of users) {
      const adjustment = startingPoints - user.points;
      if (adjustment !== 0) {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { points: startingPoints },
        });
        await tx.pointsTransaction.create({
          data: {
            userId: user.id,
            type: TransactionType.ADMIN_ADJUSTMENT,
            amount: adjustment,
            balanceAfter: updated.points,
            note: "Admin reset all points",
          },
        });
      }
    }
  });
}
