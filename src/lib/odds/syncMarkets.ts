import { MarketType, MatchStatus, OddsProvider, OptionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { MARKET_TYPE_LABELS, optionDedupeKey, teamPairKey } from "../markets";
import { isOptionStale } from "./staleness";
import type { NormalizedMatch, OddsProviderName, SyncResult } from "./types";

export type SyncMode = "all" | "matches" | "odds";

export type SyncOptions = {
  mode?: SyncMode;
  matchId?: string;
  overwriteManual?: boolean;
};

type MatchWithMarkets = Awaited<
  ReturnType<typeof prisma.match.findMany<{ include: { markets: { include: { options: true } } } }>>
>[number];

const PROTECTED_PROVIDERS: OddsProvider[] = [OddsProvider.MANUAL, OddsProvider.AI_IMAGE];

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

function inferMatchStatus(
  normalized: NormalizedMatch,
  existing?: MatchWithMarkets
): MatchStatus {
  const startTime = normalized.startTime.getTime();
  const now = Date.now();
  const eventEnded = startTime < now - 3 * 60 * 60 * 1000;

  if (eventEnded) return MatchStatus.FINISHED;
  if (existing?.status === MatchStatus.FINISHED) return MatchStatus.FINISHED;
  if (normalized.isLive) return MatchStatus.LIVE;
  if (startTime <= now) return MatchStatus.LIVE;
  return MatchStatus.UPCOMING;
}

async function logMultiplierChange(
  optionId: string,
  oldMultiplier: number,
  newMultiplier: number,
  source: OddsProvider,
  note?: string
) {
  if (oldMultiplier === newMultiplier) return;
  await prisma.oddsHistory.create({
    data: {
      marketOptionId: optionId,
      oldMultiplier,
      newMultiplier,
      source,
      note,
    },
  });
}

function isProtectedMarket(market: { provider: OddsProvider }, overwriteManual: boolean): boolean {
  if (overwriteManual) return false;
  return PROTECTED_PROVIDERS.includes(market.provider);
}

export async function syncNormalizedMatches(
  matches: NormalizedMatch[],
  provider: OddsProviderName,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const mode = options.mode ?? "all";
  const overwriteManual = options.overwriteManual ?? false;
  const missingMarketsSet = new Set<string>();

  const existingMatches = await prisma.match.findMany({
    include: { markets: { include: { options: true } } },
  });

  const byExternalId = new Map(
    existingMatches.filter((m) => m.oddsApiId).map((m) => [m.oddsApiId!, m])
  );
  const byTeamPair = new Map(existingMatches.map((m) => [teamPairKey(m.teamA, m.teamB), m]));
  const byId = new Map(existingMatches.map((m) => [m.id, m]));

  let filtered = matches;
  if (options.matchId) {
    const target = byId.get(options.matchId);
    filtered = matches.filter(
      (m) =>
        m.externalId === target?.oddsApiId ||
        (target && teamPairKey(m.teamA, m.teamB) === teamPairKey(target.teamA, target.teamB))
    );
    if (filtered.length === 0 && target?.oddsApiId) {
      filtered = matches.filter((m) => m.externalId === target.oddsApiId);
    }
  }

  let importedMatches = 0;
  let updatedMatches = 0;
  let importedMarkets = 0;
  let updatedMarkets = 0;
  const now = new Date();
  const prismaProvider = toPrismaProvider(provider);

  for (const normalized of filtered) {
    if (Number.isNaN(normalized.startTime.getTime())) continue;

    const winnerMult = extractWinnerMultipliers(normalized);
    let dbMatch: MatchWithMarkets | undefined =
      byExternalId.get(normalized.externalId) ??
      byTeamPair.get(teamPairKey(normalized.teamA, normalized.teamB));

    const matchStatus = inferMatchStatus(normalized, dbMatch);

    const matchUpdateData: Record<string, unknown> = {
      startTime: normalized.startTime,
      externalProvider: prismaProvider,
      oddsApiId: normalized.externalId,
      status: matchStatus,
    };
    if (winnerMult.multiplierTeamA !== undefined) matchUpdateData.multiplierTeamA = winnerMult.multiplierTeamA;
    if (winnerMult.multiplierDraw !== undefined) matchUpdateData.multiplierDraw = winnerMult.multiplierDraw;
    if (winnerMult.multiplierTeamB !== undefined) matchUpdateData.multiplierTeamB = winnerMult.multiplierTeamB;

    const shouldUpdateMatch = mode === "all" || mode === "matches";
    const shouldUpdateOdds = mode === "all" || mode === "odds";

    if (dbMatch) {
      if (dbMatch.status !== MatchStatus.FINISHED && shouldUpdateMatch) {
        dbMatch = await prisma.match.update({
          where: { id: dbMatch.id },
          data: matchUpdateData,
          include: { markets: { include: { options: true } } },
        });
        updatedMatches++;
      }
    } else if (mode !== "odds") {
      dbMatch = await prisma.match.create({
        data: {
          teamA: normalized.teamA,
          teamB: normalized.teamB,
          startTime: normalized.startTime,
          status: matchStatus,
          externalProvider: prismaProvider,
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
    } else {
      continue;
    }

    if (!shouldUpdateOdds || dbMatch.status === MatchStatus.FINISHED) continue;

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

      if (market && isProtectedMarket(market, overwriteManual)) {
        continue;
      }

      if (!market) {
        market = await prisma.market.create({
          data: {
            matchId: dbMatch.id,
            type: normMarket.type,
            label: normMarket.label,
            bookmaker: normMarket.bookmaker,
            provider: prismaProvider,
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
            provider: prismaProvider,
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
        const syncTime = opt.sourceTimestamp ?? now;

        const optionData = {
          label: opt.label,
          outcomeType: opt.outcomeType,
          teamName: opt.teamName,
          pointLine: opt.pointLine,
          correctScoreA: opt.correctScoreA,
          correctScoreB: opt.correctScoreB,
          multiplier: opt.multiplier,
          externalId: opt.externalId,
          provider: prismaProvider,
          bookmaker: opt.bookmaker,
          sourceSyncedAt: syncTime,
          lastSyncedAt: now,
          isStale: false,
          status: toPrismaStatus(opt.status),
        };

        if (existing) {
          if (existing.provider !== prismaProvider && PROTECTED_PROVIDERS.includes(existing.provider)) {
            continue;
          }
          await logMultiplierChange(
            existing.id,
            existing.multiplier,
            opt.multiplier,
            prismaProvider,
            "API sync"
          );
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
        if (!syncedKeys.has(key) && existing.provider === prismaProvider) {
          await prisma.marketOption.update({
            where: { id: existing.id },
            data: { status: OptionStatus.CLOSED, isStale: false },
          });
        }
      }
    }
  }

  if (mode !== "matches") {
    await markStaleApiOptions();
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

export async function markStaleApiOptions() {
  const apiOptions = await prisma.marketOption.findMany({
    where: {
      provider: { in: [OddsProvider.THEODDSAPI, OddsProvider.SPORTSGAMEODDS] },
      status: OptionStatus.ACTIVE,
    },
    include: { market: { include: { match: true } } },
  });

  for (const opt of apiOptions) {
    const stale = isOptionStale(opt, opt.market.match.status);
    if (opt.isStale !== stale) {
      await prisma.marketOption.update({
        where: { id: opt.id },
        data: { isStale: stale },
      });
    }
  }
}

export async function suspendAllMatchMarkets(matchId: string) {
  await prisma.marketOption.updateMany({
    where: { market: { matchId }, status: OptionStatus.ACTIVE },
    data: { status: OptionStatus.SUSPENDED },
  });
}

export async function closeAllMatchMarkets(matchId: string) {
  await prisma.marketOption.updateMany({
    where: { market: { matchId }, status: { in: [OptionStatus.ACTIVE, OptionStatus.SUSPENDED] } },
    data: { status: OptionStatus.CLOSED },
  });
}

export async function reopenAllMatchMarkets(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  if (match.status !== MatchStatus.UPCOMING) {
    throw new Error("Can only reopen markets before kickoff");
  }
  await prisma.marketOption.updateMany({
    where: { market: { matchId }, status: OptionStatus.SUSPENDED },
    data: { status: OptionStatus.ACTIVE },
  });
}
