"use client";

import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n";

type LanguageSwitcherProps = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  async function handleChange(next: Locale) {
    if (next !== locale) await setLocale(next);
  }

  if (compact) {
    return (
      <select
        aria-label={t.nav.language}
        value={locale}
        onChange={(e) => handleChange(e.target.value as Locale)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
      >
        <option value="vi">{t.settings.vietnamese}</option>
        <option value="en">{t.settings.english}</option>
      </select>
    );
  }

  return (
    <div>
      <label className="label">{t.settings.language}</label>
      <select
        className="input"
        value={locale}
        onChange={(e) => handleChange(e.target.value as Locale)}
      >
        <option value="vi">{t.settings.vietnamese}</option>
        <option value="en">{t.settings.english}</option>
      </select>
      <p className="text-xs text-slate-500 mt-1">{t.settings.languageHint}</p>
    </div>
  );
}
