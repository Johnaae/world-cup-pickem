import { MarketType } from "@prisma/client";

export const AI_SUPPORTED_MARKET_TYPES: MarketType[] = [
  MarketType.WINNER,
  MarketType.HANDICAP,
  MarketType.TOTAL_GOALS,
  MarketType.FIRST_HALF_WINNER,
  MarketType.FIRST_HALF_HANDICAP,
  MarketType.FIRST_HALF_TOTAL_GOALS,
  MarketType.SECOND_HALF_WINNER,
  MarketType.SECOND_HALF_HANDICAP,
  MarketType.SECOND_HALF_TOTAL_GOALS,
  MarketType.CORRECT_SCORE,
  MarketType.BOTH_TEAMS_TO_SCORE,
  MarketType.CORNER_HANDICAP,
  MarketType.TOTAL_CORNERS,
  MarketType.TOTAL_CARDS,
  MarketType.LIVE_GOAL,
  MarketType.NEXT_GOAL,
];

export type ExtractedMatchInfo = {
  homeTeam: string;
  awayTeam: string;
  startTimeText: string;
};

export type ExtractedOption = {
  label: string;
  line: number | null;
  /** Decimal odds as shown in source (e.g. 1.92) */
  decimalOdds: number;
  multiplier: number;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  source: string;
  bookmaker?: string;
  needsReview: boolean;
};

export type ExtractedMarket = {
  type: MarketType;
  label: string;
  bookmaker?: string;
  options: ExtractedOption[];
};

export type ImageOddsExtraction = {
  match: ExtractedMatchInfo;
  markets: ExtractedMarket[];
  warnings: string[];
  confidence: number;
};

export type PreviewRow = {
  id: string;
  marketType: MarketType;
  marketLabel: string;
  label: string;
  line: number | null;
  decimalOdds: number;
  multiplier: number;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  source: string;
  bookmaker: string | null;
  needsReview: boolean;
  deleted: boolean;
};

export type ApplyImageImportResult = {
  createdMarkets: number;
  updatedMarkets: number;
  createdOptions: number;
  updatedOptions: number;
  skippedNeedsReview: number;
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES = 5;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
