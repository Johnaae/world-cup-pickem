import {
  MatchStatus,
  PickOutcome,
  PickStatus,
  TransactionType,
  type Match,
  type Pick as UserPick,
  type MarketOption,
  type Market,
} from "@prisma/client";
import { prisma } from "./prisma";
import { canAutoSettle, getMatchResultOutcome, isOptionWinner, requiresManualSettlement } from "./markets";

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
  marketOptionId: string;
  pointsRisked: number;
}) {
  const option = await prisma.marketOption.findUnique({
    where: { id: params.marketOptionId },
    include: { market: { include: { match: true } } },
  });

  if (!option) throw new Error("Market option not found");
  if (option.status !== "ACTIVE") throw new Error("This market option is not available");

  const match = option.market.match;
  if (isMatchLocked(match)) throw new Error("Match has already started");

  const multiplier = option.multiplier;
  const marketId = option.marketId;
  const selectedOutcome = legacyOutcomeFromOption(option, match);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new Error("User not found");

    const existingPick = await tx.pick.findUnique({
      where: { userId_marketId: { userId: params.userId, marketId } },
    });

    if (existingPick) {
      if (existingPick.status !== PickStatus.PENDING) {
        throw new Error("Cannot edit a resolved pick");
      }

      const pointsDiff = params.pointsRisked - existingPick.pointsRisked;
      if (pointsDiff > 0 && user.points < pointsDiff) {
        throw new Error("Insufficient points");
      }

      if (pointsDiff !== 0) {
        await addTransaction(tx, {
          userId: params.userId,
          pickId: existingPick.id,
          type: pointsDiff > 0 ? TransactionType.RISK : TransactionType.REFUND,
          amount: -pointsDiff,
          note: pointsDiff > 0 ? "Increased risk on pick" : "Reduced risk on pick",
        });
      }

      return tx.pick.update({
        where: { id: existingPick.id },
        data: {
          marketOptionId: option.id,
          selectedOutcome,
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
        matchId: match.id,
        marketId,
        marketOptionId: option.id,
        selectedOutcome,
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
      note: `Pick on ${match.teamA} vs ${match.teamB} — ${option.market.label}`,
    });

    return pick;
  });
}

function legacyOutcomeFromOption(
  option: MarketOption,
  match: Match
): PickOutcome | null {
  if (option.outcomeType === "TEAM_A" || option.outcomeType === "TEAM_B" || option.outcomeType === "DRAW") {
    return option.outcomeType as PickOutcome;
  }
  if (option.outcomeType === "OVER" || option.outcomeType === "UNDER") return null;
  if (option.outcomeType === "CORRECT_SCORE") return null;
  return null;
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

async function resolvePickAsWin(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pick: UserPick
) {
  const { profit, totalReturn } = calculateWinAmount(pick.pointsRisked, pick.multiplier);
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
}

async function resolvePickAsLoss(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pick: UserPick
) {
  await tx.pointsTransaction.create({
    data: {
      userId: pick.userId,
      pickId: pick.id,
      type: TransactionType.LOSS,
      amount: 0,
      balanceAfter: (await tx.user.findUnique({ where: { id: pick.userId } }))!.points,
      note: `Lost pick (-${pick.pointsRisked} risked)`,
    },
  });
  await tx.pick.update({
    where: { id: pick.id },
    data: { status: PickStatus.LOST, pointsWon: -pick.pointsRisked },
  });
}

async function resolvePickWithOption(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pick: UserPick & { marketOption: MarketOption | null; market: Market | null },
  match: Match
) {
  if (pick.market && pick.marketOption) {
    const won = isOptionWinner(pick.marketOption, match, pick.market.type);
    if (won === null) return;
    if (won) await resolvePickAsWin(tx, pick);
    else await resolvePickAsLoss(tx, pick);
    return;
  }

  if (pick.selectedOutcome && match.scoreA !== null && match.scoreB !== null) {
    const winningOutcome = getMatchResultOutcome(match.scoreA, match.scoreB);
    if (pick.selectedOutcome === winningOutcome) await resolvePickAsWin(tx, pick);
    else await resolvePickAsLoss(tx, pick);
  }
}

export async function settleMatch(
  matchId: string,
  scores?: { scoreHalfA?: number | null; scoreHalfB?: number | null }
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (match.scoreA === null || match.scoreB === null) {
    throw new Error("Match scores are required");
  }

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreHalfA: scores?.scoreHalfA ?? match.scoreHalfA,
      scoreHalfB: scores?.scoreHalfB ?? match.scoreHalfB,
      status: MatchStatus.FINISHED,
    },
  });

  return prisma.$transaction(async (tx) => {
    const picks = await tx.pick.findMany({
      where: {
        matchId,
        status: { in: [PickStatus.PENDING, PickStatus.WON, PickStatus.LOST] },
      },
      include: { market: true, marketOption: true },
    });

    for (const pick of picks) {
      if (pick.status === PickStatus.WON || pick.status === PickStatus.LOST) {
        await reversePickResolution(tx, pick);
      }
    }

    const pendingPicks = await tx.pick.findMany({
      where: { matchId, status: PickStatus.PENDING },
      include: { market: true, marketOption: true },
    });

    for (const pick of pendingPicks) {
      if (pick.market) {
        if (pick.market.settledAt) continue;
        if (requiresManualSettlement(pick.market.type)) continue;
        if (!canAutoSettle(pick.market.type, updatedMatch)) continue;
      }
      await resolvePickWithOption(tx, pick, updatedMatch);
    }
  });
}

export async function manuallySettlePick(pickId: string, status: "WON" | "LOST") {
  return prisma.$transaction(async (tx) => {
    const pick = await tx.pick.findUnique({ where: { id: pickId } });
    if (!pick) throw new Error("Pick not found");
    if (pick.status !== PickStatus.PENDING) {
      throw new Error("Pick is already resolved");
    }

    if (status === "WON") await resolvePickAsWin(tx, pick);
    else await resolvePickAsLoss(tx, pick);
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

// Legacy helper kept for backward-compatible code paths
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

export { getMatchResultOutcome };
