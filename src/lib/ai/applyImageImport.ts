import {
  MarketType,
  OddsProvider,
  OptionSettlement,
  OptionStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import { MARKET_TYPE_LABELS, optionDedupeKey } from "../markets";
import { inferOutcomeFields } from "./normalizeExtracted";
import type { ApplyImageImportResult, PreviewRow } from "./types";

export async function applyImageImport(params: {
  matchId: string;
  rows: PreviewRow[];
  confirmNeedsReview: boolean;
}): Promise<ApplyImageImportResult> {
  const match = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!match) throw new Error("Match not found");

  const now = new Date();
  let createdMarkets = 0;
  let updatedMarkets = 0;
  let createdOptions = 0;
  let updatedOptions = 0;
  let skippedNeedsReview = 0;

  const activeRows = params.rows.filter((r) => !r.deleted);
  const touchedMarkets = new Set<MarketType>();

  await prisma.$transaction(async (tx) => {
    const marketCache = new Map<
      MarketType,
      { id: string; options: { id: string; label: string; pointLine: number | null }[] }
    >();

    for (const row of activeRows) {
      if (row.needsReview && !params.confirmNeedsReview) {
        skippedNeedsReview++;
        continue;
      }

      let market = marketCache.get(row.marketType);
      if (!market) {
        let dbMarket = await tx.market.findUnique({
          where: { matchId_type: { matchId: params.matchId, type: row.marketType } },
          include: { options: true },
        });

        if (!dbMarket) {
          dbMarket = await tx.market.create({
            data: {
              matchId: params.matchId,
              type: row.marketType,
              label: row.marketLabel || MARKET_TYPE_LABELS[row.marketType],
              provider: OddsProvider.AI_IMAGE,
              bookmaker: row.bookmaker ?? "AI_IMAGE",
              lastSyncedAt: now,
            },
            include: { options: true },
          });
          if (!touchedMarkets.has(row.marketType)) {
            createdMarkets++;
            touchedMarkets.add(row.marketType);
          }
        } else {
          if (!touchedMarkets.has(row.marketType)) {
            await tx.market.update({
              where: { id: dbMarket.id },
              data: {
                label: row.marketLabel || dbMarket.label,
                provider: OddsProvider.AI_IMAGE,
                bookmaker: row.bookmaker ?? dbMarket.bookmaker ?? "AI_IMAGE",
                lastSyncedAt: now,
              },
            });
            updatedMarkets++;
            touchedMarkets.add(row.marketType);
          }
        }

        if (dbMarket.settledAt) {
          throw new Error(`Market ${row.marketType} is settled — cannot import`);
        }

        market = {
          id: dbMarket.id,
          options: dbMarket.options.map((o) => ({
            id: o.id,
            label: o.label,
            pointLine: o.pointLine,
          })),
        };
        marketCache.set(row.marketType, market);
      }

      const inferred = inferOutcomeFields(row.label, row.marketType, row.line, match);
      const key = optionDedupeKey(row.label, row.line);
      const existing = market.options.find((o) => optionDedupeKey(o.label, o.pointLine) === key);

      const data = {
        label: row.label,
        outcomeType: inferred.outcomeType,
        teamName: inferred.teamName,
        pointLine: inferred.pointLine ?? row.line,
        correctScoreA: inferred.correctScoreA,
        correctScoreB: inferred.correctScoreB,
        multiplier: row.multiplier,
        provider: OddsProvider.AI_IMAGE,
        bookmaker: row.bookmaker ?? "AI_IMAGE",
        sourceSyncedAt: now,
        status: row.status as OptionStatus,
        note: row.needsReview ? "AI import — needs review" : null,
        settlementResult: OptionSettlement.UNSETTLED,
        externalId: `ai:${row.marketType}:${key}`,
      };

      if (existing) {
        await tx.marketOption.update({ where: { id: existing.id }, data });
        updatedOptions++;
      } else {
        const created = await tx.marketOption.create({
          data: { marketId: market.id, ...data },
        });
        market.options.push({
          id: created.id,
          label: created.label,
          pointLine: created.pointLine,
        });
        createdOptions++;
      }

      if (row.marketType === MarketType.WINNER) {
        if (inferred.outcomeType === "TEAM_A") {
          await tx.match.update({
            where: { id: params.matchId },
            data: { multiplierTeamA: row.multiplier },
          });
        } else if (inferred.outcomeType === "TEAM_B") {
          await tx.match.update({
            where: { id: params.matchId },
            data: { multiplierTeamB: row.multiplier },
          });
        } else if (inferred.outcomeType === "DRAW") {
          await tx.match.update({
            where: { id: params.matchId },
            data: { multiplierDraw: row.multiplier },
          });
        }
      }
    }
  });

  return {
    createdMarkets,
    updatedMarkets,
    createdOptions,
    updatedOptions,
    skippedNeedsReview,
  };
}
