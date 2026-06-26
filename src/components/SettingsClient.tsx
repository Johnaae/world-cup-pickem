"use client";

import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/context";

type Settings = {
  startingPoints: number;
  disclaimer: string;
  inviteCode: string;
};

export function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
  const { t, te } = useI18n();
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));
      setSettings(data.settings);
      setMessage(t.settings.saved);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.common.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">{t.settings.title}</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <LanguageSwitcher />
        <div>
          <label className="label">{t.settings.startingPoints}</label>
          <input
            type="number"
            className="input"
            min={1}
            value={settings.startingPoints}
            onChange={(e) => setSettings({ ...settings, startingPoints: parseInt(e.target.value, 10) })}
          />
        </div>
        <div>
          <label className="label">{t.settings.inviteCode}</label>
          <input
            className="input"
            value={settings.inviteCode}
            onChange={(e) => setSettings({ ...settings, inviteCode: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">{t.settings.inviteHint}</p>
        </div>
        <div>
          <label className="label">{t.settings.disclaimer}</label>
          <textarea
            className="input min-h-[120px]"
            value={settings.disclaimer}
            onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })}
          />
        </div>
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t.settings.saving : t.settings.saveSettings}
        </button>
      </form>
    </div>
  );
}
