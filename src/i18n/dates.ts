import { vi as viLocale, enUS } from "date-fns/locale";
import type { Locale } from "@/i18n";

export function getDateFnsLocale(locale: Locale) {
  return locale === "vi" ? viLocale : enUS;
}
