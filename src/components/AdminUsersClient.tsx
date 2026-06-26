"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  points: number;
  locked: boolean;
  wins: number;
  losses: number;
  totalPicks: number;
};

type PointsModal = {
  userId: string;
  userName: string;
  mode: "add" | "subtract";
};

export function AdminUsersClient() {
  const { t, te } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [pointsModal, setPointsModal] = useState<PointsModal | null>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [passwordResult, setPasswordResult] = useState<{ name: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.users) setUsers(data.users);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function patchUser(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));
      await refresh();
      return data;
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handlePointsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pointsModal) return;
    const value = parseInt(pointsInput, 10);
    if (Number.isNaN(value)) return;

    const amount = pointsModal.mode === "add" ? value : -value;
    try {
      await patchUser({ action: "adjust_points", userId: pointsModal.userId, amount });
      showMsg(t.adminUsers.pointsAdjusted);
      setPointsModal(null);
      setPointsInput("");
    } catch {
      /* handled */
    }
  }

  async function handleResetPoints(userId: string) {
    if (!confirm(t.adminUsers.resetPoints + "?")) return;
    try {
      await patchUser({ action: "reset_points", userId });
      showMsg(t.adminUsers.pointsReset);
    } catch {
      /* handled */
    }
  }

  async function handleResetPassword(userId: string, name: string) {
    if (!confirm(t.adminUsers.resetPassword + "?")) return;
    try {
      const data = await patchUser({ action: "reset_password", userId });
      setPasswordResult({ name, password: data.password });
      showMsg(t.adminUsers.passwordResetSuccess);
    } catch {
      /* handled */
    }
  }

  async function handleToggleLock(userId: string, locked: boolean) {
    try {
      await patchUser({ action: "set_locked", userId, locked });
      showMsg(locked ? t.adminUsers.accountLocked : t.adminUsers.accountUnlocked);
    } catch {
      /* handled */
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            messageType === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      {passwordResult && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <p className="font-semibold">{t.adminUsers.newPassword}</p>
          <p>
            {passwordResult.name}: <code className="text-white">{passwordResult.password}</code>
          </p>
          <button
            type="button"
            className="text-xs text-slate-400 mt-2 hover:underline"
            onClick={() => setPasswordResult(null)}
          >
            {t.common.cancel}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-left">
              <th className="px-3 py-3">{t.adminUsers.name}</th>
              <th className="px-3 py-3">{t.adminUsers.points}</th>
              <th className="px-3 py-3">{t.adminUsers.wins}</th>
              <th className="px-3 py-3">{t.adminUsers.losses}</th>
              <th className="px-3 py-3">{t.adminUsers.pickCount}</th>
              <th className="px-3 py-3">{t.adminUsers.status}</th>
              <th className="px-3 py-3">{t.adminUsers.addPoints}</th>
              <th className="px-3 py-3">{t.adminUsers.subtractPoints}</th>
              <th className="px-3 py-3">{t.adminUsers.resetPoints}</th>
              <th className="px-3 py-3">{t.adminUsers.resetPassword}</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="px-3 py-3 text-white font-medium">{user.name}</td>
                <td className={`px-3 py-3 font-semibold ${user.points < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {user.points.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-slate-300">{user.wins}</td>
                <td className="px-3 py-3 text-slate-300">{user.losses}</td>
                <td className="px-3 py-3 text-slate-300">{user.totalPicks}</td>
                <td className="px-3 py-3">
                  <span className={user.locked ? "text-red-400" : "text-emerald-400"}>
                    {user.locked ? t.adminUsers.locked : t.adminUsers.active}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={loading || user.locked}
                    className="btn-secondary text-xs !py-1 !px-2"
                    onClick={() => {
                      setPointsModal({ userId: user.id, userName: user.name, mode: "add" });
                      setPointsInput("");
                    }}
                  >
                    +
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={loading || user.locked}
                    className="btn-secondary text-xs !py-1 !px-2"
                    onClick={() => {
                      setPointsModal({ userId: user.id, userName: user.name, mode: "subtract" });
                      setPointsInput("");
                    }}
                  >
                    −
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={loading}
                    className="text-xs text-amber-400 hover:underline"
                    onClick={() => handleResetPoints(user.id)}
                  >
                    {t.adminUsers.resetPoints}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={loading}
                    className="text-xs text-slate-300 hover:underline"
                    onClick={() => handleResetPassword(user.id, user.name)}
                  >
                    {t.adminUsers.resetPassword}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={loading}
                    className="text-xs text-red-400 hover:underline"
                    onClick={() => handleToggleLock(user.id, !user.locked)}
                  >
                    {user.locked ? t.adminUsers.unlockAccount : t.adminUsers.lockAccount}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pointsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">
              {pointsModal.mode === "add" ? t.adminUsers.addPoints : t.adminUsers.subtractPoints}
            </h3>
            <p className="text-sm text-slate-400 mb-4">{pointsModal.userName}</p>
            <form onSubmit={handlePointsSubmit} className="space-y-4">
              <div>
                <label className="label">{t.adminUsers.enterPoints}</label>
                <input
                  type="number"
                  className="input"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder="500"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {t.adminUsers.confirm}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setPointsModal(null)}
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
