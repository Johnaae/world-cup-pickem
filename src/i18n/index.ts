import { vi } from "./vi";
import { en } from "./en";
import type { Dictionary, Locale } from "./types";

export type { Dictionary, Locale };

export const defaultLocale: Locale = "vi";

export const locales: Locale[] = ["vi", "en"];

export const LOCALE_COOKIE = "wcp_locale";

const dictionaries: Record<Locale, Dictionary> = { vi, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "vi" || value === "en";
}

/** Replace {key} placeholders in a string */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function translateError(
  dict: Dictionary,
  error: string | undefined,
  errorKey?: string
): string {
  if (errorKey && dict.errors[errorKey]) return dict.errors[errorKey];
  if (!error) return dict.common.somethingWrong;

  const keyMap: Record<string, string> = {
    "Invalid invite code": "INVALID_INVITE",
    "Email already registered": "EMAIL_EXISTS",
    "Invalid email or password": "INVALID_CREDENTIALS",
    "Registration failed": "REGISTRATION_FAILED",
    "Login failed": "LOGIN_FAILED",
    "Unauthorized": "UNAUTHORIZED",
    "Forbidden": "FORBIDDEN",
    "Insufficient points": "INSUFFICIENT_POINTS",
    "Match has already started": "MATCH_LOCKED",
    "This market option is not available": "OPTION_UNAVAILABLE",
    "Cannot edit a resolved pick": "PICK_RESOLVED",
    "Failed to sync matches and multipliers.": "SYNC_FAILED",
    "Option not found": "OPTION_NOT_FOUND",
    "Market is settled — cannot edit options": "MARKET_SETTLED",
    "Cannot delete option with pending picks — suspend or close instead": "DELETE_HAS_PICKS",
    "MAX_MATCH_POINTS_EXCEEDED": "MAX_MATCH_POINTS_EXCEEDED",
    "Account is locked": "ACCOUNT_LOCKED",
  };

  const key = keyMap[error];
  if (key && dict.errors[key]) return dict.errors[key];
  return error;
}
