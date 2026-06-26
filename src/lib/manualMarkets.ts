import {
  MarketType,
  OddsProvider,
  OptionStatus,
  OptionSettlement,
} from "@prisma/client";
import { prisma } from "./prisma";
import { MARKET_TYPE_LABELS, optionDedupeKey } from "./markets";

export type CreateOptionInput = {
  matchId: string;
  marketType: MarketType;
  label: string;
  outcomeType?: string;
  teamName?: string | null;
  pointLine?: number | null;
  correctScoreA?: number | null;
  correctScoreB?: number | null;
  multiplier: number;
  status?: OptionStatus;
  note?: string | null;
};

export async function upsertManualOption(input: CreateOptionInput) {
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match) throw new Error("Match not found");

  const now = new Date();
  const outcomeType = input.outcomeType ?? input.marketType;
  const pointLine = input.pointLine ?? null;

  return prisma.$transaction(async (tx) => {
    let market = await tx.market.findUnique({
      where: { matchId_type: { matchId: input.matchId, type: input.marketType } },
      include: { options: true },
    });

    if (!market) {
      market = await tx.market.create({
        data: {
          matchId: input.matchId,
          type: input.marketType,
          label: MARKET_TYPE_LABELS[input.marketType],
          provider: OddsProvider.MANUAL,
          bookmaker: "Manual",
          lastSyncedAt: now,
        },
        include: { options: true },
      });
    }

    if (market.settledAt) {
      throw new Error("Market is settled — create a new market or duplicate to another match");
    }

    const key = optionDedupeKey(input.label, pointLine);
    const existing = market.options.find((o) => optionDedupeKey(o.label, o.pointLine) === key);

    const data = {
      label: input.label,
      outcomeType,
      teamName: input.teamName ?? null,
      pointLine,
      correctScoreA: input.correctScoreA ?? null,
      correctScoreB: input.correctScoreB ?? null,
      multiplier: input.multiplier,
      provider: OddsProvider.MANUAL,
      bookmaker: "Manual",
      sourceSyncedAt: now,
      status: input.status ?? OptionStatus.ACTIVE,
      note: input.note ?? null,
      settlementResult: OptionSettlement.UNSETTLED,
      externalId: `manual:${input.marketType}:${key}`,
    };

    if (existing) {
      return tx.marketOption.update({ where: { id: existing.id }, data });
    }

    return tx.marketOption.create({ data: { marketId: market.id, ...data } });
  });
}

export async function duplicateMarketToMatch(sourceMarketId: string, targetMatchId: string) {
  const source = await prisma.market.findUnique({
    where: { id: sourceMarketId },
    include: { options: true },
  });
  if (!source) throw new Error("Source market not found");

  const targetMatch = await prisma.match.findUnique({ where: { id: targetMatchId } });
  if (!targetMatch) throw new Error("Target match not found");

  const existing = await prisma.market.findUnique({
    where: { matchId_type: { matchId: targetMatchId, type: source.type } },
  });
  if (existing) {
    throw new Error(
      `Target match already has a ${MARKET_TYPE_LABELS[source.type]} market — delete it first or edit in place`
    );
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const market = await tx.market.create({
      data: {
        matchId: targetMatchId,
        type: source.type,
        label: source.label,
        provider: OddsProvider.MANUAL,
        bookmaker: "Manual",
        lastSyncedAt: now,
      },
    });

    for (const opt of source.options) {
      const key = optionDedupeKey(opt.label, opt.pointLine);
      await tx.marketOption.create({
        data: {
          marketId: market.id,
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
          status: opt.status,
          note: opt.note,
          settlementResult: OptionSettlement.UNSETTLED,
          externalId: `manual:${source.type}:${key}`,
        },
      });
    }

    return market;
  });
}
