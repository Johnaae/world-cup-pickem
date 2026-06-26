import { MarketType, PickOutcome, type Match, type MarketOption } from "@prisma/client";

export { MarketType };

export const API_MARKET_TO_TYPE: Record<string, MarketType> = {
  h2h: MarketType.WINNER,
  spreads: MarketType.HANDICAP,
  totals: MarketType.TOTAL_GOALS,
  h2h_h1: MarketType.FIRST_HALF_WINNER,
  spreads_h1: MarketType.FIRST_HALF_HANDICAP,
  totals_h1: MarketType.FIRST_HALF_TOTAL_GOALS,
  correct_score: MarketType.CORRECT_SCORE,
};

export const MARKET_TYPE_LABELS: Record<MarketType, string> = {
  [MarketType.WINNER]: "Winner",
  [MarketType.HANDICAP]: "Handicap",
  [MarketType.TOTAL_GOALS]: "Total Goals",
  [MarketType.FIRST_HALF_WINNER]: "First Half Winner",
  [MarketType.FIRST_HALF_HANDICAP]: "First Half Handicap",
  [MarketType.FIRST_HALF_TOTAL_GOALS]: "First Half Total Goals",
  [MarketType.SECOND_HALF_WINNER]: "Second Half Winner",
  [MarketType.SECOND_HALF_HANDICAP]: "Second Half Handicap",
  [MarketType.SECOND_HALF_TOTAL_GOALS]: "Second Half Total Goals",
  [MarketType.CORRECT_SCORE]: "Correct Score",
  [MarketType.BOTH_TEAMS_TO_SCORE]: "Both Teams To Score",
  [MarketType.TOTAL_CORNERS]: "Total Corners",
  [MarketType.CORNER_HANDICAP]: "Corner Handicap",
  [MarketType.TOTAL_CARDS]: "Total Cards",
  [MarketType.NEXT_GOAL]: "Next Goal",
  [MarketType.LIVE_GOAL]: "Live Goal",
};

export const FIRST_HALF_TYPES: MarketType[] = [
  MarketType.FIRST_HALF_WINNER,
  MarketType.FIRST_HALF_HANDICAP,
  MarketType.FIRST_HALF_TOTAL_GOALS,
];

export const SECOND_HALF_TYPES: MarketType[] = [
  MarketType.SECOND_HALF_WINNER,
  MarketType.SECOND_HALF_HANDICAP,
  MarketType.SECOND_HALF_TOTAL_GOALS,
];

export const MANUAL_MARKET_TYPES: MarketType[] = [
  MarketType.WINNER,
  MarketType.HANDICAP,
  MarketType.TOTAL_GOALS,
  ...FIRST_HALF_TYPES,
  ...SECOND_HALF_TYPES,
  MarketType.CORRECT_SCORE,
  MarketType.BOTH_TEAMS_TO_SCORE,
  MarketType.TOTAL_CORNERS,
  MarketType.CORNER_HANDICAP,
  MarketType.TOTAL_CARDS,
  MarketType.NEXT_GOAL,
  MarketType.LIVE_GOAL,
];

export const AUTO_SETTLE_TYPES: MarketType[] = [
  MarketType.WINNER,
  MarketType.HANDICAP,
  MarketType.TOTAL_GOALS,
  MarketType.CORRECT_SCORE,
];

export const HALF_SCORE_SETTLE_TYPES: MarketType[] = [
  MarketType.FIRST_HALF_WINNER,
  MarketType.FIRST_HALF_HANDICAP,
  MarketType.FIRST_HALF_TOTAL_GOALS,
];

export const MANUAL_SETTLE_TYPES: MarketType[] = [
  MarketType.BOTH_TEAMS_TO_SCORE,
  MarketType.TOTAL_CORNERS,
  MarketType.CORNER_HANDICAP,
  MarketType.TOTAL_CARDS,
  MarketType.NEXT_GOAL,
  MarketType.LIVE_GOAL,
];

export type PickTab =
  | "winner"
  | "handicap"
  | "totals"
  | "firstHalf"
  | "correctScore"
  | "btts"
  | "corners"
  | "cards"
  | "live";

export const TAB_MARKET_TYPES: Record<PickTab, MarketType[]> = {
  winner: [MarketType.WINNER],
  handicap: [MarketType.HANDICAP],
  totals: [MarketType.TOTAL_GOALS],
  firstHalf: FIRST_HALF_TYPES,
  correctScore: [MarketType.CORRECT_SCORE],
  btts: [MarketType.BOTH_TEAMS_TO_SCORE],
  corners: [MarketType.TOTAL_CORNERS, MarketType.CORNER_HANDICAP],
  cards: [MarketType.TOTAL_CARDS],
  live: [MarketType.NEXT_GOAL, MarketType.LIVE_GOAL],
};

export const TAB_LABELS: Record<PickTab, string> = {
  winner: "Winner",
  handicap: "Handicap",
  totals: "Total Goals",
  firstHalf: "1st Half",
  correctScore: "Correct Score",
  btts: "BTTS",
  corners: "Corners",
  cards: "Cards",
  live: "Live",
};

export const PICK_TABS: PickTab[] = [
  "winner",
  "handicap",
  "totals",
  "firstHalf",
  "correctScore",
  "btts",
  "corners",
  "cards",
  "live",
];

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getMatchResultOutcome(scoreA: number, scoreB: number): PickOutcome {
  if (scoreA > scoreB) return PickOutcome.TEAM_A;
  if (scoreA < scoreB) return PickOutcome.TEAM_B;
  return PickOutcome.DRAW;
}

export function outcomeTypeFromTeam(
  teamName: string,
  match: Pick<Match, "teamA" | "teamB">
): string {
  const norm = normalizeTeamName(teamName);
  if (norm === "draw") return "DRAW";
  if (norm === normalizeTeamName(match.teamA)) return "TEAM_A";
  if (norm === normalizeTeamName(match.teamB)) return "TEAM_B";
  return "UNKNOWN";
}

export function parseCorrectScore(name: string): { scoreA: number; scoreB: number } | null {
  const match = name.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!match) return null;
  return { scoreA: parseInt(match[1], 10), scoreB: parseInt(match[2], 10) };
}

export function teamPairKey(teamA: string, teamB: string): string {
  return [normalizeTeamName(teamA), normalizeTeamName(teamB)].sort().join("|");
}

export function optionDedupeKey(label: string, pointLine: number | null | undefined): string {
  return `${label}|${pointLine ?? "null"}`;
}

export function isOptionWinner(
  option: MarketOption,
  match: Match,
  marketType: MarketType
): boolean | null {
  const scoreA = getScoresForMarket(match, marketType)?.scoreA;
  const scoreB = getScoresForMarket(match, marketType)?.scoreB;
  if (scoreA === null || scoreA === undefined || scoreB === null || scoreB === undefined) {
    return null;
  }

  switch (marketType) {
    case MarketType.WINNER:
    case MarketType.FIRST_HALF_WINNER: {
      const outcome = getMatchResultOutcome(scoreA, scoreB);
      return option.outcomeType === outcome;
    }
    case MarketType.HANDICAP:
    case MarketType.FIRST_HALF_HANDICAP:
    case MarketType.CORNER_HANDICAP: {
      if (option.pointLine === null || option.pointLine === undefined) return null;
      if (option.outcomeType === "TEAM_A") {
        return scoreA + option.pointLine > scoreB;
      }
      if (option.outcomeType === "TEAM_B") {
        return scoreB + option.pointLine > scoreA;
      }
      return false;
    }
    case MarketType.TOTAL_GOALS:
    case MarketType.FIRST_HALF_TOTAL_GOALS:
    case MarketType.TOTAL_CORNERS:
    case MarketType.TOTAL_CARDS: {
      if (option.pointLine === null || option.pointLine === undefined) return null;
      const total = scoreA + scoreB;
      if (option.outcomeType === "OVER") return total > option.pointLine;
      if (option.outcomeType === "UNDER") return total < option.pointLine;
      return false;
    }
    case MarketType.CORRECT_SCORE: {
      if (option.correctScoreA === null || option.correctScoreB === null) return null;
      return scoreA === option.correctScoreA && scoreB === option.correctScoreB;
    }
    default:
      return null;
  }
}

function getScoresForMarket(
  match: Match,
  marketType: MarketType
): { scoreA: number | null; scoreB: number | null } | null {
  if (
    marketType === MarketType.FIRST_HALF_WINNER ||
    marketType === MarketType.FIRST_HALF_HANDICAP ||
    marketType === MarketType.FIRST_HALF_TOTAL_GOALS
  ) {
    if (match.scoreHalfA === null || match.scoreHalfB === null) return null;
    return { scoreA: match.scoreHalfA, scoreB: match.scoreHalfB };
  }
  if (match.scoreA === null || match.scoreB === null) return null;
  return { scoreA: match.scoreA, scoreB: match.scoreB };
}

export function canAutoSettle(marketType: MarketType, match: Match): boolean {
  if (AUTO_SETTLE_TYPES.includes(marketType)) {
    return match.scoreA !== null && match.scoreB !== null;
  }
  if (HALF_SCORE_SETTLE_TYPES.includes(marketType)) {
    return match.scoreHalfA !== null && match.scoreHalfB !== null;
  }
  return false;
}

export function requiresManualSettlement(marketType: MarketType): boolean {
  return MANUAL_SETTLE_TYPES.includes(marketType);
}

export function isManualOnlyMarketType(marketType: MarketType): boolean {
  return MANUAL_SETTLE_TYPES.includes(marketType) || marketType === MarketType.CORRECT_SCORE;
}
