import { OddsProvider, MarketType, OptionStatus, OptionSettlement } from "@prisma/client";
import { prisma } from "../prisma";
import { optionDedupeKey } from "../markets";
import { parseBulkMarketText } from "./bulkPaste";

export async function applyBulkMarketPaste(matchId: string, text: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  const { markets, errors } = parseBulkMarketText(text, {
    teamA: match.teamA,
    teamB: match.teamB,
  });

  if (markets.length === 0) {
    return {
      createdMarkets: 0,
      updatedMarkets: 0,
      createdOptions: 0,
      updatedOptions: 0,
      errors,
    };
  }

  const now = new Date();
  let createdMarkets = 0;
  let updatedMarkets = 0;
  let createdOptions = 0;
  let updatedOptions = 0;

  await prisma.$transaction(async (tx) => {
    for (const parsed of markets) {
      let market = await tx.market.findUnique({
        where: { matchId_type: { matchId, type: parsed.type } },
        include: { options: true },
      });

      if (!market) {
        market = await tx.market.create({
          data: {
            matchId,
            type: parsed.type,
            label: parsed.label,
            provider: OddsProvider.MANUAL,
            bookmaker: "Manual",
            lastSyncedAt: now,
          },
          include: { options: true },
        });
        createdMarkets++;
      } else {
        await tx.market.update({
          where: { id: market.id },
          data: {
            label: parsed.label,
            provider: OddsProvider.MANUAL,
            bookmaker: "Manual",
            lastSyncedAt: now,
          },
        });
        updatedMarkets++;
      }

      const existingByKey = new Map(
        market.options.map((o) => [optionDedupeKey(o.label, o.pointLine), o])
      );

      for (const opt of parsed.options) {
        const key = optionDedupeKey(opt.label, opt.pointLine);
        const existing = existingByKey.get(key);

        const data = {
          label: opt.label,
          outcomeType: opt.outcomeType,
          teamName: opt.teamName,
          pointLine: opt.pointLine,
          correctScoreA: opt.correctScoreA,
          correctScoreB: opt.correctScoreB,
          multiplier: opt.multiplier,
          provider: OddsProvider.MANUAL,
          bookmaker: "Manual",
          sourceSyncedAt: now,
          status: OptionStatus.ACTIVE,
          settlementResult: OptionSettlement.UNSETTLED,
          externalId: `manual:${parsed.type}:${key}`,
        };

        if (existing) {
          await tx.marketOption.update({ where: { id: existing.id }, data });
          updatedOptions++;
        } else {
          await tx.marketOption.create({ data: { marketId: market.id, ...data } });
          createdOptions++;
        }
      }

      if (parsed.type === MarketType.WINNER) {
        const teamA = parsed.options.find((o) => o.outcomeType === "TEAM_A");
        const draw = parsed.options.find((o) => o.outcomeType === "DRAW");
        const teamB = parsed.options.find((o) => o.outcomeType === "TEAM_B");
        await tx.match.update({
          where: { id: matchId },
          data: {
            ...(teamA ? { multiplierTeamA: teamA.multiplier } : {}),
            ...(draw ? { multiplierDraw: draw.multiplier } : {}),
            ...(teamB ? { multiplierTeamB: teamB.multiplier } : {}),
          },
        });
      }
    }
  });

  return {
    createdMarkets,
    updatedMarkets,
    createdOptions,
    updatedOptions,
    errors,
  };
}
