import { MarketType, MatchStatus, OddsProvider, OptionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { MARKET_TYPE_LABELS, optionDedupeKey, teamPairKey } from "../markets";
import type { NormalizedMatch, OddsProviderName, SyncResult } from "./types";

type MatchWithMarkets = Awaited<
  ReturnType<typeof prisma.match.findMany<{ include: { markets: { include: { options: true } } } }>>
>[number];

function toPrismaProvider(provider: OddsProviderName): OddsProvider {
  return provider as OddsProvider;
}

function toPrismaStatus(status: "ACTIVE" | "SUSPENDED" | "CLOSED"): OptionStatus {
  return status as OptionStatus;
}

function extractWinnerMultipliers(match: NormalizedMatch) {
  const winner = match.markets.find((m) => m.type === MarketType.WINNER);
  const byType = (type: string) =>
    winner?.options.find((o) => o.outcomeType === type && o.status === "ACTIVE")?.multiplier;
  return {
    multiplierTeamA: byType("TEAM_A") ?? undefined,
    multiplierDraw: byType("DRAW") ?? undefined,
    multiplierTeamB: byType("TEAM_B") ?? undefined,
  };
}

export async function syncNormalizedMatches(
  matches: NormalizedMatch[],
  provider: OddsProviderName
): Promise<SyncResult> {
  const missingMarketsSet = new Set<string>();
  const existingMatches = await prisma.match.findMany({
    include: { markets: { include: { options: true } } },
  });

  const byExternalId = new Map(
    existingMatches.filter((m) => m.oddsApiId).map((m) => [m.oddsApiId!, m])
  );
  const byTeamPair = new Map(
    existingMatches.map((m) => [teamPairKey(m.teamA, m.teamB), m])
  );

  let importedMatches = 0;
  let updatedMatches = 0;
  let importedMarkets = 0;
  let updatedMarkets = 0;
  const now = new Date();

  for (const normalized of matches) {
    if (Number.isNaN(normalized.startTime.getTime())) continue;

    const winnerMult = extractWinnerMultipliers(normalized);
    let dbMatch: MatchWithMarkets | undefined =
      byExternalId.get(normalized.externalId) ??
      byTeamPair.get(teamPairKey(normalized.teamA, normalized.teamB));

    const matchStatus =
      normalized.isLive && dbMatch?.status !== MatchStatus.FINISHED
        ? MatchStatus.LIVE
        : dbMatch?.status ?? MatchStatus.UPCOMING;

    const matchUpdateData: Record<string, unknown> = {
      startTime: normalized.startTime,
      externalProvider: toPrismaProvider(provider),
      oddsApiId: normalized.externalId,
    };
    if (winnerMult.multiplierTeamA !== undefined) matchUpdateData.multiplierTeamA = winnerMult.multiplierTeamA;
    if (winnerMult.multiplierDraw !== undefined) matchUpdateData.multiplierDraw = winnerMult.multiplierDraw;
    if (winnerMult.multiplierTeamB !== undefined) matchUpdateData.multiplierTeamB = winnerMult.multiplierTeamB;
    if (normalized.isLive && dbMatch?.status !== MatchStatus.FINISHED) {
      matchUpdateData.status = MatchStatus.LIVE;
    }

    if (dbMatch) {
      if (dbMatch.status !== MatchStatus.FINISHED) {
        dbMatch = await prisma.match.update({
          where: { id: dbMatch.id },
          data: matchUpdateData,
          include: { markets: { include: { options: true } } },
        });
        updatedMatches++;
      }
    } else {
      dbMatch = await prisma.match.create({
        data: {
          teamA: normalized.teamA,
          teamB: normalized.teamB,
          startTime: normalized.startTime,
          status: normalized.isLive ? MatchStatus.LIVE : MatchStatus.UPCOMING,
          externalProvider: toPrismaProvider(provider),
          oddsApiId: normalized.externalId,
          multiplierTeamA: winnerMult.multiplierTeamA ?? 1.5,
          multiplierDraw: winnerMult.multiplierDraw ?? 3.0,
          multiplierTeamB: winnerMult.multiplierTeamB ?? 2.5,
        },
        include: { markets: { include: { options: true } } },
      });
      byExternalId.set(normalized.externalId, dbMatch);
      byTeamPair.set(teamPairKey(normalized.teamA, normalized.teamB), dbMatch);
      importedMatches++;
    }

    if (dbMatch.status === MatchStatus.FINISHED) continue;

    const syncedMarketTypes = new Set(normalized.markets.map((m) => m.type));

    for (const marketType of Object.values(MarketType)) {
      if (!syncedMarketTypes.has(marketType)) {
        missingMarketsSet.add(MARKET_TYPE_LABELS[marketType]);
      }
    }

    for (const normMarket of normalized.markets) {
      if (normMarket.options.length === 0) {
        missingMarketsSet.add(MARKET_TYPE_LABELS[normMarket.type]);
        continue;
      }

      let market = dbMatch.markets.find((m) => m.type === normMarket.type);
      if (!market) {
        market = await prisma.market.create({
          data: {
            matchId: dbMatch.id,
            type: normMarket.type,
            label: normMarket.label,
            bookmaker: normMarket.bookmaker,
            provider: toPrismaProvider(normMarket.provider),
            lastSyncedAt: now,
          },
          include: { options: true },
        });
        dbMatch.markets.push(market);
        importedMarkets++;
      } else {
        await prisma.market.update({
          where: { id: market.id },
          data: {
            label: normMarket.label,
            bookmaker: normMarket.bookmaker,
            provider: toPrismaProvider(normMarket.provider),
            lastSyncedAt: now,
          },
        });
        updatedMarkets++;
      }

      const existingOptions = new Map(
        market.options.map((o) => [optionDedupeKey(o.label, o.pointLine), o])
      );

      const syncedKeys = new Set<string>();

      for (const opt of normMarket.options) {
        const key = optionDedupeKey(opt.label, opt.pointLine);
        syncedKeys.add(key);
        const existing = existingOptions.get(key);
        const optionData = {
          label: opt.label,
          outcomeType: opt.outcomeType,
          teamName: opt.teamName,
          pointLine: opt.pointLine,
          correctScoreA: opt.correctScoreA,
          correctScoreB: opt.correctScoreB,
          multiplier: opt.multiplier,
          externalId: opt.externalId,
          provider: toPrismaProvider(opt.provider),
          bookmaker: opt.bookmaker,
          sourceSyncedAt: opt.sourceTimestamp ?? now,
          status: toPrismaStatus(opt.status),
        };

        if (existing) {
          await prisma.marketOption.update({
            where: { id: existing.id },
            data: optionData,
          });
        } else {
          await prisma.marketOption.create({
            data: { marketId: market.id, ...optionData },
          });
        }
      }

      for (const [key, existing] of existingOptions) {
        if (!syncedKeys.has(key) && existing.provider === toPrismaProvider(provider)) {
          await prisma.marketOption.update({
            where: { id: existing.id },
            data: { status: OptionStatus.CLOSED },
          });
        }
      }
    }
  }

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { lastOddsSyncAt: now, oddsProvider: provider },
    create: { id: "default", lastOddsSyncAt: now, oddsProvider: provider },
  });

  return {
    provider,
    importedMatches,
    updatedMatches,
    importedMarkets,
    updatedMarkets,
    missingMarkets: Array.from(missingMarketsSet),
    lastSyncedAt: now.toISOString(),
  };
}
