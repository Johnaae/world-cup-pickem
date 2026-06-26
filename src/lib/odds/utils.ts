import type { OptionStatusName } from "./types";

/** Convert decimal price to profit multiplier (e.g. 2.5 → 1.5). */
export function decimalToMultiplier(decimalOdds: number): number {
  const multiplier = decimalOdds - 1;
  return Math.round(Math.max(0.1, multiplier) * 100) / 100;
}

export function americanToDecimal(american: number): number {
  if (american === 0) return 1;
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

export function parsePriceToDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (value > 1 && value < 50) return value;
    if (Math.abs(value) >= 100 || (value <= -100)) return americanToDecimal(value);
    if (value > 0) return value;
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = parseFloat(trimmed.replace("+", ""));
    if (Number.isNaN(num)) return null;
    return parsePriceToDecimal(num);
  }
  return null;
}

export function averageDecimals(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function resolveOptionStatus(
  availableCount: number,
  totalCount: number,
  eventEnded: boolean
): OptionStatusName {
  if (eventEnded) return "CLOSED";
  if (availableCount > 0) return "ACTIVE";
  if (totalCount > 0) return "SUSPENDED";
  return "SUSPENDED";
}

export function getConfiguredOddsProvider(): "SPORTSGAMEODDS" | "THEODDSAPI" {
  const provider = (process.env.ODDS_PROVIDER || "THEODDSAPI").toUpperCase();
  return provider === "THEODDSAPI" ? "THEODDSAPI" : "SPORTSGAMEODDS";
}
