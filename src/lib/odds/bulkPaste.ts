import { MarketType } from "@prisma/client";
import {
  MARKET_TYPE_LABELS,
  normalizeTeamName,
  outcomeTypeFromTeam,
  parseCorrectScore,
} from "../markets";
import { decimalToMultiplier } from "./utils";

export type ParsedBulkOption = {
  label: string;
  outcomeType: string;
  teamName: string | null;
  pointLine: number | null;
  correctScoreA: number | null;
  correctScoreB: number | null;
  multiplier: number;
  decimalOdds: number;
};

export type ParsedBulkMarket = {
  type: MarketType;
  label: string;
  options: ParsedBulkOption[];
};

const MARKET_NAME_MAP: Record<string, MarketType> = {
  winner: MarketType.WINNER,
  "1x2": MarketType.WINNER,
  handicap: MarketType.HANDICAP,
  spread: MarketType.HANDICAP,
  "total goals": MarketType.TOTAL_GOALS,
  totals: MarketType.TOTAL_GOALS,
  "over under": MarketType.TOTAL_GOALS,
  "first half winner": MarketType.FIRST_HALF_WINNER,
  "1st half winner": MarketType.FIRST_HALF_WINNER,
  "first half handicap": MarketType.FIRST_HALF_HANDICAP,
  "1st half handicap": MarketType.FIRST_HALF_HANDICAP,
  "first half total goals": MarketType.FIRST_HALF_TOTAL_GOALS,
  "1st half total goals": MarketType.FIRST_HALF_TOTAL_GOALS,
  "correct score": MarketType.CORRECT_SCORE,
  "both teams to score": MarketType.BOTH_TEAMS_TO_SCORE,
  btts: MarketType.BOTH_TEAMS_TO_SCORE,
  "total corners": MarketType.TOTAL_CORNERS,
  corners: MarketType.TOTAL_CORNERS,
  "corner handicap": MarketType.CORNER_HANDICAP,
  "total cards": MarketType.TOTAL_CARDS,
  cards: MarketType.TOTAL_CARDS,
  "next goal": MarketType.NEXT_GOAL,
  "live goal": MarketType.LIVE_GOAL,
};

function resolveMarketType(name: string): MarketType | null {
  const key = name.trim().toLowerCase();
  if (MARKET_NAME_MAP[key]) return MARKET_NAME_MAP[key];
  for (const [k, v] of Object.entries(MARKET_NAME_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function parseOverUnderLabel(
  labelPart: string,
  multiplier: number,
  decimalOdds: number
): ParsedBulkOption | null {
  const overMatch = labelPart.match(/^Over\s+([\d.]+)(?:\s+\w+)?$/i);
  const underMatch = labelPart.match(/^Under\s+([\d.]+)(?:\s+\w+)?$/i);
  if (overMatch) {
    return {
      label: labelPart,
      outcomeType: "OVER",
      teamName: null,
      pointLine: parseFloat(overMatch[1]),
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }
  if (underMatch) {
    return {
      label: labelPart,
      outcomeType: "UNDER",
      teamName: null,
      pointLine: parseFloat(underMatch[1]),
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }
  return null;
}

function parseYesNoLabel(
  labelPart: string,
  multiplier: number,
  decimalOdds: number
): ParsedBulkOption | null {
  const lower = labelPart.toLowerCase();
  if (lower === "yes") {
    return {
      label: labelPart,
      outcomeType: "YES",
      teamName: null,
      pointLine: null,
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }
  if (lower === "no") {
    return {
      label: labelPart,
      outcomeType: "NO",
      teamName: null,
      pointLine: null,
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }
  return null;
}

function parseGenericOption(
  labelPart: string,
  multiplier: number,
  decimalOdds: number,
  marketType: MarketType
): ParsedBulkOption {
  const lineMatch = labelPart.match(/([+-]?\d+(?:\.\d+)?)/);
  return {
    label: labelPart,
    outcomeType: marketType,
    teamName: null,
    pointLine: lineMatch ? parseFloat(lineMatch[1]) : null,
    correctScoreA: null,
    correctScoreB: null,
    multiplier,
    decimalOdds,
  };
}

function parseOptionLine(
  labelPart: string,
  decimalOdds: number,
  marketType: MarketType,
  match: { teamA: string; teamB: string }
): ParsedBulkOption | null {
  const multiplier = decimalToMultiplier(decimalOdds);
  const lower = labelPart.toLowerCase();

  if (marketType === MarketType.WINNER || marketType === MarketType.FIRST_HALF_WINNER) {
    if (lower === "draw") {
      return {
        label: "Draw",
        outcomeType: "DRAW",
        teamName: null,
        pointLine: null,
        correctScoreA: null,
        correctScoreB: null,
        multiplier,
        decimalOdds,
      };
    }
    const outcomeType = outcomeTypeFromTeam(labelPart, match);
    if (outcomeType === "UNKNOWN") return null;
    return {
      label: labelPart,
      outcomeType,
      teamName: outcomeType === "DRAW" ? null : labelPart,
      pointLine: null,
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }

  if (
    marketType === MarketType.HANDICAP ||
    marketType === MarketType.FIRST_HALF_HANDICAP ||
    marketType === MarketType.CORNER_HANDICAP
  ) {
    const handicapMatch = labelPart.match(/^(.+?)\s*([+-]\d+(?:\.\d+)?)\s*$/);
    if (!handicapMatch) return null;
    const teamPart = handicapMatch[1].trim();
    const line = parseFloat(handicapMatch[2]);
    const outcomeType = outcomeTypeFromTeam(teamPart, match);
    if (outcomeType === "UNKNOWN") return null;
    return {
      label: labelPart,
      outcomeType,
      teamName: teamPart,
      pointLine: line,
      correctScoreA: null,
      correctScoreB: null,
      multiplier,
      decimalOdds,
    };
  }

  if (
    marketType === MarketType.TOTAL_GOALS ||
    marketType === MarketType.FIRST_HALF_TOTAL_GOALS ||
    marketType === MarketType.TOTAL_CORNERS ||
    marketType === MarketType.TOTAL_CARDS
  ) {
    return parseOverUnderLabel(labelPart, multiplier, decimalOdds);
  }

  if (marketType === MarketType.BOTH_TEAMS_TO_SCORE) {
    const yesNo = parseYesNoLabel(labelPart, multiplier, decimalOdds);
    if (yesNo) return yesNo;
    return null;
  }

  if (marketType === MarketType.CORRECT_SCORE) {
    const parsed = parseCorrectScore(labelPart.replace("–", "-"));
    if (!parsed) return null;
    return {
      label: `${parsed.scoreA}-${parsed.scoreB}`,
      outcomeType: "CORRECT_SCORE",
      teamName: null,
      pointLine: null,
      correctScoreA: parsed.scoreA,
      correctScoreB: parsed.scoreB,
      multiplier,
      decimalOdds,
    };
  }

  if (marketType === MarketType.NEXT_GOAL || marketType === MarketType.LIVE_GOAL) {
    const teamOutcome = outcomeTypeFromTeam(labelPart, match);
    if (teamOutcome !== "UNKNOWN") {
      return {
        label: labelPart,
        outcomeType: teamOutcome,
        teamName: labelPart,
        pointLine: null,
        correctScoreA: null,
        correctScoreB: null,
        multiplier,
        decimalOdds,
      };
    }
    if (lower === "no goal" || lower === "none") {
      return {
        label: labelPart,
        outcomeType: "NO_GOAL",
        teamName: null,
        pointLine: null,
        correctScoreA: null,
        correctScoreB: null,
        multiplier,
        decimalOdds,
      };
    }
    return parseGenericOption(labelPart, multiplier, decimalOdds, marketType);
  }

  return null;
}

export function parseBulkMarketText(
  text: string,
  match: { teamA: string; teamB: string }
): { markets: ParsedBulkMarket[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const markets: ParsedBulkMarket[] = [];
  const errors: string[] = [];
  let currentMarket: ParsedBulkMarket | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (/^Market:/i.test(line)) {
      const marketName = line.replace(/^Market:\s*/i, "").trim();
      const type = resolveMarketType(marketName);
      if (!type) {
        errors.push(`Line ${lineNum}: Unknown market type "${marketName}"`);
        currentMarket = null;
        continue;
      }
      currentMarket = { type, label: MARKET_TYPE_LABELS[type], options: [] };
      markets.push(currentMarket);
      continue;
    }

    if (!currentMarket) {
      errors.push(`Line ${lineNum}: Add a "Market:" header before option lines`);
      continue;
    }

    const pipeMatch = line.match(/^(.+?)\s*\|\s*([\d.]+)\s*$/);
    if (!pipeMatch) {
      errors.push(`Line ${lineNum}: Use format "Label | 1.92"`);
      continue;
    }

    const labelPart = pipeMatch[1].trim();
    const decimal = parseFloat(pipeMatch[2]);
    if (Number.isNaN(decimal) || decimal <= 1) {
      errors.push(`Line ${lineNum}: Decimal price must be greater than 1.0`);
      continue;
    }

    const option = parseOptionLine(labelPart, decimal, currentMarket.type, match);
    if (!option) {
      errors.push(
        `Line ${lineNum}: Could not parse "${labelPart}" for ${currentMarket.label}. Check team names match ${match.teamA} / ${match.teamB}.`
      );
      continue;
    }

    const duplicate = currentMarket.options.some(
      (o) =>
        normalizeTeamName(o.label) === normalizeTeamName(option.label) &&
        o.pointLine === option.pointLine
    );
    if (duplicate) {
      errors.push(`Line ${lineNum}: Duplicate option "${labelPart}" in paste — will update existing on import`);
      const idx = currentMarket.options.findIndex(
        (o) =>
          normalizeTeamName(o.label) === normalizeTeamName(option.label) &&
          o.pointLine === option.pointLine
      );
      if (idx >= 0) currentMarket.options[idx] = option;
      continue;
    }

    currentMarket.options.push(option);
  }

  const nonEmpty = markets.filter((m) => m.options.length > 0);
  if (markets.length > 0 && nonEmpty.length === 0) {
    errors.push("No valid options were parsed. Check your format and team names.");
  }

  return { markets: nonEmpty, errors };
}

export const BULK_PASTE_EXAMPLE = `Market: Handicap
France -1.5 | 1.92
Senegal +1.5 | 1.88

Market: Total Goals
Over 2.5 | 1.85
Under 2.5 | 1.95

Market: Correct Score
1-0 | 6.50
2-0 | 8.00
1-1 | 7.00

Market: Corners
Over 8.5 corners | 1.90
Under 8.5 corners | 1.90`;
