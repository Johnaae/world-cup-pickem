import { MatchStatus, type Match } from "@prisma/client";
import { prisma } from "./prisma";

export type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
};

export type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
  lastSyncedAt: string;
};

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function teamPairKey(teamA: string, teamB: string): string {
  return [normalizeTeamName(teamA), normalizeTeamName(teamB)].sort().join("|");
}

/** Convert decimal price to profit multiplier (e.g. 2.5 → 1.5). */
export function decimalToMultiplier(decimalOdds: number): number {
  const multiplier = decimalOdds - 1;
  return Math.round(Math.max(0.1, multiplier) * 100) / 100;
}

function averageOutcomePrice(
  event: OddsApiEvent,
  outcomeName: string
): number | null {
  const prices: number[] = [];
  const target = normalizeTeamName(outcomeName);
  const isDraw = target === "draw";

  for (const bookmaker of event.bookmakers) {
    for (const market of bookmaker.markets) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes) {
        const name = normalizeTeamName(outcome.name);
        const matches =
          isDraw
            ? name === "draw"
            : name === target;
        if (matches && outcome.price > 1) {
          prices.push(outcome.price);
        }
      }
    }
  }

  if (prices.length === 0) return null;
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  return avg;
}

export function extractMultipliers(event: OddsApiEvent) {
  const teamADecimal = averageOutcomePrice(event, event.home_team);
  const teamBDecimal = averageOutcomePrice(event, event.away_team);
  const drawDecimal = averageOutcomePrice(event, "Draw");

  return {
    multiplierTeamA: decimalToMultiplier(teamADecimal ?? 1.5),
    multiplierDraw: decimalToMultiplier(drawDecimal ?? 3.0),
    multiplierTeamB: decimalToMultiplier(teamBDecimal ?? 2.5),
  };
}

function buildTeamPairIndex(matches: Match[]) {
  const index = new Map<string, Match>();
  for (const match of matches) {
    index.set(teamPairKey(match.teamA, match.teamB), match);
  }
  return index;
}

export async function syncMatchesFromOddsApi(events: OddsApiEvent[]): Promise<SyncResult> {
  const existingMatches = await prisma.match.findMany();
  const byOddsId = new Map(
    existingMatches.filter((m) => m.oddsApiId).map((m) => [m.oddsApiId!, m])
  );
  const byTeamPair = buildTeamPairIndex(existingMatches);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const startTime = new Date(event.commence_time);
    if (Number.isNaN(startTime.getTime())) {
      skipped++;
      continue;
    }

    const multipliers = extractMultipliers(event);
    const existing =
      byOddsId.get(event.id) ??
      byTeamPair.get(teamPairKey(event.home_team, event.away_team));

    if (existing) {
      if (existing.status === MatchStatus.FINISHED) {
        skipped++;
        continue;
      }

      await prisma.match.update({
        where: { id: existing.id },
        data: {
          startTime,
          multiplierTeamA: multipliers.multiplierTeamA,
          multiplierDraw: multipliers.multiplierDraw,
          multiplierTeamB: multipliers.multiplierTeamB,
          oddsApiId: existing.oddsApiId ?? event.id,
        },
      });
      updated++;
      continue;
    }

    const match = await prisma.match.create({
      data: {
        teamA: event.home_team,
        teamB: event.away_team,
        startTime,
        status: MatchStatus.UPCOMING,
        multiplierTeamA: multipliers.multiplierTeamA,
        multiplierDraw: multipliers.multiplierDraw,
        multiplierTeamB: multipliers.multiplierTeamB,
        oddsApiId: event.id,
      },
    });

    byOddsId.set(event.id, match);
    byTeamPair.set(teamPairKey(event.home_team, event.away_team), match);
    created++;
  }

  const lastSyncedAt = new Date();
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { lastOddsSyncAt: lastSyncedAt },
    create: {
      id: "default",
      lastOddsSyncAt: lastSyncedAt,
    },
  });

  return {
    created,
    updated,
    skipped,
    lastSyncedAt: lastSyncedAt.toISOString(),
  };
}

export class OddsApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
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
  const market = process.env.ODDS_API_MARKET || "h2h";

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", region);
  url.searchParams.set("markets", market);
  url.searchParams.set("oddsFormat", "decimal");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
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
