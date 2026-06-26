import { OptionSettlement, PickStatus, TransactionType } from "@prisma/client";
import { prisma } from "./prisma";
import { calculateWinAmount } from "./points";

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
}

export async function updateOptionSettlement(
  optionId: string,
  settlementResult: "WON" | "LOST" | "UNSETTLED"
) {
  const option = await prisma.marketOption.findUnique({
    where: { id: optionId },
    include: { market: true },
  });
  if (!option) throw new Error("Option not found");
  if (option.market.settledAt) {
    throw new Error("Market is already settled — cannot change option results");
  }

  return prisma.marketOption.update({
    where: { id: optionId },
    data: { settlementResult: settlementResult as OptionSettlement },
  });
}

export async function settleMarketByOptions(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { options: true },
  });
  if (!market) throw new Error("Market not found");
  if (market.settledAt) throw new Error("Market has already been settled");

  const unsettled = market.options.filter((o) => o.settlementResult === OptionSettlement.UNSETTLED);
  if (unsettled.length > 0) {
    throw new Error(
      `Mark all options as WON or LOST before settling (${unsettled.length} still unsettled)`
    );
  }

  const wonCount = market.options.filter((o) => o.settlementResult === OptionSettlement.WON).length;
  if (wonCount === 0) {
    throw new Error("At least one option must be marked WON");
  }

  return prisma.$transaction(async (tx) => {
    const picks = await tx.pick.findMany({
      where: { marketId, status: PickStatus.PENDING },
      include: { marketOption: true },
    });

    for (const pick of picks) {
      if (!pick.marketOption) continue;

      const alreadyResolved = await tx.pick.findFirst({
        where: { id: pick.id, status: { not: PickStatus.PENDING } },
      });
      if (alreadyResolved) continue;

      if (pick.marketOption.settlementResult === OptionSettlement.WON) {
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
      } else if (pick.marketOption.settlementResult === OptionSettlement.LOST) {
        const user = await tx.user.findUnique({ where: { id: pick.userId } });
        await tx.pointsTransaction.create({
          data: {
            userId: pick.userId,
            pickId: pick.id,
            type: TransactionType.LOSS,
            amount: 0,
            balanceAfter: user!.points,
            note: `Lost pick (-${pick.pointsRisked} risked)`,
          },
        });
        await tx.pick.update({
          where: { id: pick.id },
          data: { status: PickStatus.LOST, pointsWon: -pick.pointsRisked },
        });
      }
    }

    await tx.market.update({
      where: { id: marketId },
      data: { settledAt: new Date() },
    });

    return { settledPicks: picks.length };
  });
}
