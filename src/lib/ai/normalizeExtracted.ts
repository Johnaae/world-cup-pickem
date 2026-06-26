import { MarketType, OptionStatus } from "@prisma/client";
import { z } from "zod";
import { decimalToMultiplier, parsePriceToDecimal } from "../odds/utils";
import { MARKET_TYPE_LABELS, parseCorrectScore } from "../markets";
import { AI_SUPPORTED_MARKET_TYPES, type ExtractedMarket, type ImageOddsExtraction, type PreviewRow } from "./types";

const marketTypeSchema = z.enum(
  AI_SUPPORTED_MARKET_TYPES as [MarketType, ...MarketType[]]
);

const rawOptionSchema = z.object({
  label: z.string().min(1),
  line: z.number().nullable().optional(),
  multiplier: z.number().optional(),
  decimalOdds: z.number().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  source: z.string().optional(),
  bookmaker: z.string().optional(),
  needsReview: z.boolean().optional(),
});

const rawMarketSchema = z.object({
  type: marketTypeSchema,
  label: z.string().optional(),
  bookmaker: z.string().optional(),
  options: z.array(rawOptionSchema),
});

const rawExtractionSchema = z.object({
  match: z
    .object({
      homeTeam: z.string().optional(),
      awayTeam: z.string().optional(),
      startTimeText: z.string().optional(),
    })
    .optional(),
  markets: z.array(rawMarketSchema),
  warnings: z.array(z.string()).optional(),
});

export function parseAiJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

function resolveDecimalOdds(option: z.infer<typeof rawOptionSchema>, warnings: string[]): number | null {
  if (option.decimalOdds && option.decimalOdds > 1) {
    return Math.round(option.decimalOdds * 1000) / 1000;
  }
  if (option.multiplier !== undefined && option.multiplier !== null) {
    const parsed = parsePriceToDecimal(option.multiplier);
    if (parsed && parsed > 1) return Math.round(parsed * 1000) / 1000;
  }
  warnings.push(`Không rõ tỷ lệ cho "${option.label}" — cần kiểm tra.`);
  return null;
}

function inferOutcomeFields(
  label: string,
  marketType: MarketType,
  line: number | null,
  match: { teamA: string; teamB: string }
) {
  const lower = label.toLowerCase();
  if (marketType === MarketType.CORRECT_SCORE) {
    const parsed = parseCorrectScore(label.replace("–", "-"));
    if (parsed) {
      return {
        outcomeType: "CORRECT_SCORE",
        teamName: null,
        pointLine: null,
        correctScoreA: parsed.scoreA,
        correctScoreB: parsed.scoreB,
      };
    }
  }
  if (lower.startsWith("over") || lower.startsWith("tài")) {
    return { outcomeType: "OVER", teamName: null, pointLine: line, correctScoreA: null, correctScoreB: null };
  }
  if (lower.startsWith("under") || lower.startsWith("xỉu")) {
    return { outcomeType: "UNDER", teamName: null, pointLine: line, correctScoreA: null, correctScoreB: null };
  }
  if (lower === "yes" || lower === "có") {
    return { outcomeType: "YES", teamName: null, pointLine: null, correctScoreA: null, correctScoreB: null };
  }
  if (lower === "no" || lower === "không") {
    return { outcomeType: "NO", teamName: null, pointLine: null, correctScoreA: null, correctScoreB: null };
  }
  if (lower === "draw" || lower === "hòa") {
    return { outcomeType: "DRAW", teamName: null, pointLine: null, correctScoreA: null, correctScoreB: null };
  }
  const normA = match.teamA.toLowerCase();
  const normB = match.teamB.toLowerCase();
  if (label.toLowerCase().includes(normA)) {
    return { outcomeType: "TEAM_A", teamName: match.teamA, pointLine: line, correctScoreA: null, correctScoreB: null };
  }
  if (label.toLowerCase().includes(normB)) {
    return { outcomeType: "TEAM_B", teamName: match.teamB, pointLine: line, correctScoreA: null, correctScoreB: null };
  }
  return {
    outcomeType: marketType,
    teamName: null,
    pointLine: line,
    correctScoreA: null,
    correctScoreB: null,
  };
}

export function normalizeExtraction(
  raw: unknown,
  match: { teamA: string; teamB: string },
  bookmakerPreference?: string
): ImageOddsExtraction {
  const parsed = rawExtractionSchema.parse(raw);
  const warnings = [...(parsed.warnings ?? [])];
  const markets: ExtractedMarket[] = [];

  for (const market of parsed.markets) {
    if (!AI_SUPPORTED_MARKET_TYPES.includes(market.type)) {
      warnings.push(`Bỏ qua loại kèo không hỗ trợ: ${market.type}`);
      continue;
    }

    const bookmaker = bookmakerPreference || market.bookmaker || undefined;
    const options: ExtractedMarket["options"] = [];

    for (const opt of market.options) {
      const decimalOdds = resolveDecimalOdds(opt, warnings);
      const needsReview = opt.needsReview ?? decimalOdds === null;
      if (decimalOdds === null) {
        continue;
      }

      options.push({
        label: opt.label.trim(),
        line: opt.line ?? null,
        decimalOdds,
        multiplier: decimalToMultiplier(decimalOdds),
        status: (opt.status ?? "ACTIVE") as OptionStatus,
        source: opt.source ?? "AI_IMAGE",
        bookmaker,
        needsReview,
      });
    }

    if (options.length > 0) {
      markets.push({
        type: market.type,
        label: market.label?.trim() || MARKET_TYPE_LABELS[market.type],
        bookmaker,
        options,
      });
    }
  }

  const needsReviewCount = markets.reduce(
    (sum, m) => sum + m.options.filter((o) => o.needsReview).length,
    0
  );
  const confidence = Math.max(
    0,
    Math.min(1, 1 - warnings.length * 0.08 - needsReviewCount * 0.04)
  );

  return {
    match: {
      homeTeam: parsed.match?.homeTeam ?? match.teamA,
      awayTeam: parsed.match?.awayTeam ?? match.teamB,
      startTimeText: parsed.match?.startTimeText ?? "",
    },
    markets,
    warnings,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export function extractionToPreviewRows(extraction: ImageOddsExtraction): PreviewRow[] {
  const rows: PreviewRow[] = [];
  for (const market of extraction.markets) {
    for (const opt of market.options) {
      rows.push({
        id: crypto.randomUUID(),
        marketType: market.type,
        marketLabel: market.label,
        label: opt.label,
        line: opt.line,
        decimalOdds: opt.decimalOdds,
        multiplier: opt.multiplier,
        status: opt.status,
        source: opt.source,
        bookmaker: opt.bookmaker ?? market.bookmaker ?? null,
        needsReview: opt.needsReview,
        deleted: false,
      });
    }
  }
  return rows;
}

export { inferOutcomeFields };
