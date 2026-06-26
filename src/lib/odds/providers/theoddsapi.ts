import { MarketType } from "@prisma/client";
import {
  API_MARKET_TO_TYPE,
  MARKET_TYPE_LABELS,
  normalizeTeamName,
  optionDedupeKey,
  outcomeTypeFromTeam,
  parseCorrectScore,
} from "../../markets";
import type { NormalizedMarket, NormalizedMarketOption, NormalizedMatch } from "../types";
import { OddsProviderError } from "../types";
import {
  averageDecimals,
  decimalToMultiplier,
  parsePriceToDecimal,
  resolveOptionStatus,
} from "../utils";

export type TheOddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type TheOddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title?: string;
    markets: Array<{
      key: string;
      outcomes: TheOddsApiOutcome[];
    }>;
  }>;
};

function getRequestedApiMarkets(): string[] {
  const raw =
    process.env.ODDS_API_MARKETS ||
    process.env.ODDS_API_MARKET ||
    "h2h,spreads,totals,h2h_h1,spreads_h1,totals_h1,correct_score";
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

function buildOptionLabel(
  marketType: MarketType,
  outcome: TheOddsApiOutcome,
  match: { teamA: string; teamB: string }
): string {
  if (marketType === MarketType.TOTAL_GOALS || marketType === MarketType.FIRST_HALF_TOTAL_GOALS) {
    return `${outcome.name} ${outcome.point ?? ""}`.trim();
  }
  if (marketType === MarketType.HANDICAP || marketType === MarketType.FIRST_HALF_HANDICAP) {
    const sign = outcome.point && outcome.point > 0 ? "+" : "";
    return `${outcome.name} ${outcome.point !== undefined ? `${sign}${outcome.point}` : ""}`.trim();
  }
  if (marketType === MarketType.CORRECT_SCORE) return outcome.name;
  return outcome.name;
}

function parseTheOddsApiOutcome(
  marketType: MarketType,
  outcome: TheOddsApiOutcome,
  match: { teamA: string; teamB: string },
  bookmaker: string,
  eventEnded: boolean
): NormalizedMarketOption | null {
  const decimal = parsePriceToDecimal(outcome.price);
  if (!decimal || decimal <= 1) return null;

  const label = buildOptionLabel(marketType, outcome, match);
  let outcomeType = "UNKNOWN";
  let teamName: string | null = null;
  let pointLine: number | null = outcome.point ?? null;
  let correctScoreA: number | null = null;
  let correctScoreB: number | null = null;

  if (marketType === MarketType.WINNER || marketType === MarketType.FIRST_HALF_WINNER) {
    outcomeType = outcomeTypeFromTeam(outcome.name, match);
    teamName = normalizeTeamName(outcome.name) === "draw" ? null : outcome.name;
  } else if (marketType === MarketType.HANDICAP || marketType === MarketType.FIRST_HALF_HANDICAP) {
    outcomeType = outcomeTypeFromTeam(outcome.name, match);
    teamName = outcome.name;
  } else if (marketType === MarketType.TOTAL_GOALS || marketType === MarketType.FIRST_HALF_TOTAL_GOALS) {
    outcomeType = normalizeTeamName(outcome.name) === "over" ? "OVER" : "UNDER";
  } else if (marketType === MarketType.CORRECT_SCORE) {
    outcomeType = "CORRECT_SCORE";
    const parsed = parseCorrectScore(outcome.name);
    if (!parsed) return null;
    correctScoreA = parsed.scoreA;
    correctScoreB = parsed.scoreB;
  }

  if (outcomeType === "UNKNOWN") return null;

  return {
    label,
    outcomeType,
    teamName,
    pointLine,
    correctScoreA,
    correctScoreB,
    multiplier: decimalToMultiplier(decimal),
    externalId: `${marketType}:${label}:${pointLine ?? "null"}:${bookmaker}`,
    provider: "THEODDSAPI",
    bookmaker,
    sourceTimestamp: new Date(),
    status: resolveOptionStatus(1, 1, eventEnded),
  };
}

function extractMarketOptions(
  event: TheOddsApiEvent,
  apiMarketKey: string,
  marketType: MarketType,
  eventEnded: boolean
): NormalizedMarketOption[] {
  const match = { teamA: event.home_team, teamB: event.away_team };
  const optionMap = new Map<string, { option: NormalizedMarketOption; decimals: number[] }>();

  for (const bookmaker of event.bookmakers) {
    for (const market of bookmaker.markets) {
      if (market.key !== apiMarketKey) continue;
      for (const outcome of market.outcomes) {
        const parsed = parseTheOddsApiOutcome(
          marketType,
          outcome,
          match,
          bookmaker.title || bookmaker.key,
          eventEnded
        );
        if (!parsed) continue;

        const key = optionDedupeKey(parsed.label, parsed.pointLine);
        const existing = optionMap.get(key);
        const decimal = parsePriceToDecimal(outcome.price);
        if (!decimal) continue;

        if (existing) {
          existing.decimals.push(decimal);
          if (parsed.status === "ACTIVE") existing.option.status = "ACTIVE";
        } else {
          optionMap.set(key, { option: parsed, decimals: [decimal] });
        }
      }
    }
  }

  return Array.from(optionMap.values()).map(({ option, decimals }) => {
    const avg = averageDecimals(decimals);
    if (!avg) return option;
    return { ...option, multiplier: decimalToMultiplier(avg) };
  });
}

export function normalizeTheOddsApiEvent(event: TheOddsApiEvent): NormalizedMatch {
  const startTime = new Date(event.commence_time);
  const eventEnded = startTime.getTime() < Date.now() - 3 * 60 * 60 * 1000;
  const isLive = startTime <= new Date() && !eventEnded;
  const markets: NormalizedMarket[] = [];

  for (const apiKey of getRequestedApiMarkets()) {
    const marketType = API_MARKET_TO_TYPE[apiKey];
    if (!marketType) continue;

    const options = extractMarketOptions(event, apiKey, marketType, eventEnded);
    if (options.length === 0) continue;

    markets.push({
      type: marketType,
      label: MARKET_TYPE_LABELS[marketType],
      provider: "THEODDSAPI",
      bookmaker: options[0]?.bookmaker ?? null,
      options,
    });
  }

  return {
    externalId: event.id,
    teamA: event.home_team,
    teamB: event.away_team,
    startTime,
    isLive,
    provider: "THEODDSAPI",
    markets,
  };
}

export async function fetchTheOddsApiEvents(): Promise<TheOddsApiEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new OddsProviderError(
      "The Odds API backup is not configured. Please add ODDS_API_KEY to the server environment.",
      400,
      "THEODDSAPI"
    );
  }

  const sportKey = process.env.ODDS_API_SPORT_KEY || "soccer_fifa_world_cup";
  const region = process.env.ODDS_API_REGION || "us";
  const markets = getRequestedApiMarkets().join(",");

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", region);
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", "decimal");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const requestsRemainingHeader = response.headers.get("x-requests-remaining");
  const requestsRemaining = requestsRemainingHeader
    ? parseInt(requestsRemainingHeader, 10)
    : null;

  if (response.status === 429 || requestsRemaining === 0) {
    throw new OddsProviderError("Sync limit reached. Please try again later.", 429, "THEODDSAPI");
  }

  if (response.status === 401 || response.status === 403) {
    throw new OddsProviderError(
      "The Odds API backup is not configured. Please check your API key.",
      401,
      "THEODDSAPI"
    );
  }

  if (!response.ok) {
    throw new OddsProviderError("Failed to sync from The Odds API backup.", response.status, "THEODDSAPI");
  }

  return (await response.json()) as TheOddsApiEvent[];
}

export async function fetchTheOddsApiMatches(): Promise<NormalizedMatch[]> {
  const events = await fetchTheOddsApiEvents();
  return events.map(normalizeTheOddsApiEvent);
}

export async function fetchTheOddsApiRemaining(): Promise<number | null> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  const sportKey = process.env.ODDS_API_SPORT_KEY || "soccer_fifa_world_cup";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  const response = await fetch(url.toString(), { cache: "no-store" });
  const header = response.headers.get("x-requests-remaining");
  return header ? parseInt(header, 10) : null;
}
