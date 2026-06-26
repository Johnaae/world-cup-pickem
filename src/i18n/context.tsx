"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  formatMessage,
  getDictionary,
  isLocale,
  translateError,
  type Dictionary,
  type Locale,
} from "./index";

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => Promise<void>;
  t: Dictionary;
  fmt: typeof formatMessage;
  te: (error?: string, errorKey?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : defaultLocale
  );

  const dict = useMemo(() => getDictionary(locale), [locale]);

  const setLocale = useCallback(async (next: Locale) => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    setLocaleState(next);
    document.documentElement.lang = next;
  }, []);

  const te = useCallback(
    (error?: string, errorKey?: string) => translateError(dict, error, errorKey),
    [dict]
  );

  const value = useMemo(
    () => ({ locale, dict, setLocale, t: dict, fmt: formatMessage, te }),
    [locale, dict, setLocale, te]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
