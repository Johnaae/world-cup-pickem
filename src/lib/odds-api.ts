import { MarketType, MatchStatus, type Match } from "@prisma/client";
import { prisma } from "./prisma";
import {
  API_MARKET_TO_TYPE,
  MARKET_TYPE_LABELS,
  normalizeTeamName,
  optionDedupeKey,
  outcomeTypeFromTeam,
  parseCorrectScore,
  teamPairKey,
} from "./markets";

export type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title?: string;
    markets: Array<{
      key: string;
      outcomes: OddsApiOutcome[];
    }>;
  }>;
};

export type SyncResult = {
  importedMatches: number;
  updatedMatches: number;
  importedMarkets: number;
  updatedMarkets: number;
  missingMarkets: string[];
  lastSyncedAt: string;
};

/** Convert decimal price to profit multiplier (e.g. 2.5 → 1.5). */
export function decimalToMultiplier(decimalOdds: number): number {
  const multiplier = decimalOdds - 1;
  return Math.round(Math.max(0.1, multiplier) * 100) / 100;
}

function averagePrices(prices: number[]): number | null {
  if (prices.length === 0) return null;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

type ParsedOption = {
  label: string;
  outcomeType: string;
  teamName: string | null;
  pointLine: number | null;
  correctScoreA: number | null;
  correctScoreB: number | null;
  multiplier: number;
  externalId: string | null;
  prices: number[];
};

function buildOptionLabel(
  marketType: MarketType,
  outcome: OddsApiOutcome,
  match: { teamA: string; teamB: string }
): string {
  if (marketType === MarketType.TOTAL_GOALS || marketType === MarketType.FIRST_HALF_TOTAL_GOALS) {
    const line = outcome.point !== undefined ? outcome.point : "";
    return `${outcome.name} ${line}`;
  }
  if (marketType === MarketType.HANDICAP || marketType === MarketType.FIRST_HALF_HANDICAP) {
    const sign = outcome.point && outcome.point > 0 ? "+" : "";
    const line = outcome.point !== undefined ? `${sign}${outcome.point}` : "";
    return `${outcome.name} ${line}`.trim();
  }
  if (marketType === MarketType.CORRECT_SCORE) {
    return outcome.name;
  }
  return outcome.name;
}

function parseOutcome(
  marketType: MarketType,
  outcome: OddsApiOutcome,
  match: { teamA: string; teamB: string }
): Omit<ParsedOption, "prices" | "multiplier"> {
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
    if (parsed) {
      correctScoreA = parsed.scoreA;
      correctScoreB = parsed.scoreB;
    }
  }

  return {
    label,
    outcomeType,
    teamName,
    pointLine,
    correctScoreA,
    correctScoreB,
    externalId: `${marketType}:${label}:${pointLine ?? "null"}`,
  };
}

function extractMarketOptions(
  event: OddsApiEvent,
  apiMarketKey: string,
  marketType: MarketType
): ParsedOption[] {
  const match = { teamA: event.home_team, teamB: event.away_team };
  const optionMap = new Map<string, ParsedOption>();

  for (const bookmaker of event.bookmakers) {
    for (const market of bookmaker.markets) {
      if (market.key !== apiMarketKey) continue;
      for (const outcome of market.outcomes) {
        if (!outcome.price || outcome.price <= 1) continue;
        const parsed = parseOutcome(marketType, outcome, match);
        const key = optionDedupeKey(parsed.label, parsed.pointLine);
        const existing = optionMap.get(key);
        if (existing) {
          existing.prices.push(outcome.price);
        } else {
          optionMap.set(key, { ...parsed, prices: [outcome.price], multiplier: 0 });
        }
      }
    }
  }

  return Array.from(optionMap.values()).map((opt) => ({
    ...opt,
    multiplier: decimalToMultiplier(averagePrices(opt.prices) ?? 1.5),
  }));
}

function extractWinnerMultipliers(event: OddsApiEvent) {
  const options = extractMarketOptions(event, "h2h", MarketType.WINNER);
  const byType = (type: string) => options.find((o) => o.outcomeType === type)?.multiplier;
  return {
    multiplierTeamA: byType("TEAM_A") ?? 1.5,
    multiplierDraw: byType("DRAW") ?? 3.0,
    multiplierTeamB: byType("TEAM_B") ?? 2.5,
  };
}

type MatchWithMarkets = Match & {
  markets: Array<{ id: string; type: MarketType; options: Array<{ id: string; label: string; pointLine: number | null }> }>;
};

function buildTeamPairIndex(matches: MatchWithMarkets[]) {
  const index = new Map<string, MatchWithMarkets>();
  for (const match of matches) {
    index.set(teamPairKey(match.teamA, match.teamB), match);
  }
  return index;
}

function getRequestedApiMarkets(): string[] {
  const raw = process.env.ODDS_API_MARKETS || process.env.ODDS_API_MARKET || "h2h";
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

export async function syncMatchesFromOddsApi(events: OddsApiEvent[]): Promise<SyncResult> {
  const requestedMarkets = getRequestedApiMarkets();
  const missingMarketsSet = new Set<string>();
  const existingMatches = await prisma.match.findMany({
    include: { markets: { include: { options: true } } },
  }) as MatchWithMarkets[];
  const byOddsId = new Map(existingMatches.filter((m) => m.oddsApiId).map((m) => [m.oddsApiId!, m]));
  const byTeamPair = buildTeamPairIndex(existingMatches);

  let importedMatches = 0;
  let updatedMatches = 0;
  let importedMarkets = 0;
  let updatedMarkets = 0;
  const now = new Date();

  for (const event of events) {
    const startTime = new Date(event.commence_time);
    if (Number.isNaN(startTime.getTime())) continue;

    const winnerMultipliers = extractWinnerMultipliers(event);
    let dbMatch: MatchWithMarkets | undefined =
      byOddsId.get(event.id) ??
      byTeamPair.get(teamPairKey(event.home_team, event.away_team));

    if (dbMatch) {
      if (dbMatch.status !== MatchStatus.FINISHED) {
        dbMatch = (await prisma.match.update({
          where: { id: dbMatch.id },
          data: {
            startTime,
            multiplierTeamA: winnerMultipliers.multiplierTeamA,
            multiplierDraw: winnerMultipliers.multiplierDraw,
            multiplierTeamB: winnerMultipliers.multiplierTeamB,
            oddsApiId: dbMatch.oddsApiId ?? event.id,
          },
          include: { markets: { include: { options: true } } },
        })) as MatchWithMarkets;
        updatedMatches++;
      }
    } else {
      dbMatch = (await prisma.match.create({
        data: {
          teamA: event.home_team,
          teamB: event.away_team,
          startTime,
          status: MatchStatus.UPCOMING,
          multiplierTeamA: winnerMultipliers.multiplierTeamA,
          multiplierDraw: winnerMultipliers.multiplierDraw,
          multiplierTeamB: winnerMultipliers.multiplierTeamB,
          oddsApiId: event.id,
        },
        include: { markets: { include: { options: true } } },
      })) as MatchWithMarkets;
      byOddsId.set(event.id, dbMatch);
      byTeamPair.set(teamPairKey(event.home_team, event.away_team), dbMatch);
      importedMatches++;
    }

    if (dbMatch.status === MatchStatus.FINISHED) continue;

    for (const apiKey of requestedMarkets) {
      const marketType = API_MARKET_TO_TYPE[apiKey];
      if (!marketType) continue;

      const parsedOptions = extractMarketOptions(event, apiKey, marketType);
      if (parsedOptions.length === 0) {
        missingMarketsSet.add(MARKET_TYPE_LABELS[marketType]);
        continue;
      }

      let market = dbMatch.markets.find((m) => m.type === marketType);
      if (!market) {
        market = await prisma.market.create({
          data: {
            matchId: dbMatch.id,
            type: marketType,
            label: MARKET_TYPE_LABELS[marketType],
            lastSyncedAt: now,
          },
          include: { options: true },
        });
        dbMatch.markets.push(market);
        importedMarkets++;
      } else {
        await prisma.market.update({
          where: { id: market.id },
          data: { lastSyncedAt: now },
        });
        updatedMarkets++;
      }

      const existingOptions = new Map(
        market.options.map((o) => [optionDedupeKey(o.label, o.pointLine), o])
      );

      for (const opt of parsedOptions) {
        const key = optionDedupeKey(opt.label, opt.pointLine);
        const existing = existingOptions.get(key);
        if (existing) {
          await prisma.marketOption.update({
            where: { id: existing.id },
            data: {
              multiplier: opt.multiplier,
              outcomeType: opt.outcomeType,
              teamName: opt.teamName,
              correctScoreA: opt.correctScoreA,
              correctScoreB: opt.correctScoreB,
              externalId: opt.externalId,
            },
          });
        } else {
          await prisma.marketOption.create({
            data: {
              marketId: market.id,
              label: opt.label,
              outcomeType: opt.outcomeType,
              teamName: opt.teamName,
              pointLine: opt.pointLine,
              correctScoreA: opt.correctScoreA,
              correctScoreB: opt.correctScoreB,
              multiplier: opt.multiplier,
              externalId: opt.externalId,
            },
          });
        }
      }
    }
  }

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { lastOddsSyncAt: now },
    create: { id: "default", lastOddsSyncAt: now },
  });

  return {
    importedMatches,
    updatedMatches,
    importedMarkets,
    updatedMarkets,
    missingMarkets: Array.from(missingMarketsSet),
    lastSyncedAt: now.toISOString(),
  };
}

export class OddsApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "OddsApiError";
  }
}

export async function fetchOddsApiEvents(): Promise<{
  events: OddsApiEvent[];
  requestsRemaining: number | null;
}> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new OddsApiError(
      "Sync is not configured. Please add your API key to the server environment.",
      400
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

  if (response.status === 429) {
    throw new OddsApiError("Sync limit reached. Please try again later.", 429);
  }

  if (response.status === 401 || response.status === 403) {
    throw new OddsApiError(
      "Sync is not configured. Please add your API key to the server environment.",
      401
    );
  }

  if (!response.ok) {
    const body = await response.text();
    if (
      body.toLowerCase().includes("quota") ||
      body.toLowerCase().includes("usage limit") ||
      requestsRemaining === 0
    ) {
      throw new OddsApiError("Sync limit reached. Please try again later.", 429);
    }
    throw new OddsApiError("Failed to sync matches and multipliers.", response.status);
  }

  if (requestsRemaining === 0) {
    throw new OddsApiError("Sync limit reached. Please try again later.", 429);
  }

  const events = (await response.json()) as OddsApiEvent[];
  return { events, requestsRemaining };
}
