import { getServerLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/context";

export async function AppI18nProvider({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  return <I18nProvider initialLocale={locale}>{children}</I18nProvider>;
}
