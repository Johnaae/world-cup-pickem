import { MarketType } from "@prisma/client";

export type OddsProviderName = "SPORTSGAMEODDS" | "THEODDSAPI" | "MANUAL";

export type OptionStatusName = "ACTIVE" | "SUSPENDED" | "CLOSED";

export type NormalizedMarketOption = {
  label: string;
  outcomeType: string;
  teamName: string | null;
  pointLine: number | null;
  correctScoreA: number | null;
  correctScoreB: number | null;
  multiplier: number;
  externalId: string;
  provider: OddsProviderName;
  bookmaker: string | null;
  sourceTimestamp: Date | null;
  status: OptionStatusName;
};

export type NormalizedMarket = {
  type: MarketType;
  label: string;
  provider: OddsProviderName;
  bookmaker: string | null;
  options: NormalizedMarketOption[];
};

export type NormalizedMatch = {
  externalId: string;
  teamA: string;
  teamB: string;
  startTime: Date;
  isLive: boolean;
  provider: OddsProviderName;
  markets: NormalizedMarket[];
};

export type SyncResult = {
  provider: OddsProviderName;
  importedMatches: number;
  updatedMatches: number;
  importedMarkets: number;
  updatedMarkets: number;
  missingMarkets: string[];
  lastSyncedAt: string;
};

export type OddsProviderAdapter = {
  name: OddsProviderName;
  fetchMatches(): Promise<NormalizedMatch[]>;
};

export class OddsProviderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public provider?: OddsProviderName
  ) {
    super(message);
    this.name = "OddsProviderError";
  }
}

/** @deprecated use OddsProviderError */
export { OddsProviderError as OddsApiError };
