"use client";

import { useState } from "react";

type Settings = {
  startingPoints: number;
  disclaimer: string;
  inviteCode: string;
};

export function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
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
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      setMessage("Settings saved!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">App Settings</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">Starting Points</label>
          <input
            type="number"
            className="input"
            min={1}
            value={settings.startingPoints}
            onChange={(e) => setSettings({ ...settings, startingPoints: parseInt(e.target.value, 10) })}
          />
        </div>
        <div>
          <label className="label">Invite Code</label>
          <input
            className="input"
            value={settings.inviteCode}
            onChange={(e) => setSettings({ ...settings, inviteCode: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">Friends need this code to register.</p>
        </div>
        <div>
          <label className="label">Disclaimer</label>
          <textarea
            className="input min-h-[120px]"
            value={settings.disclaimer}
            onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })}
          />
        </div>
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
