"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/context";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const { t, te } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: mode === "login" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { name, email, password, inviteCode }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.somethingWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card w-full max-w-md">
      <h1 className="text-2xl font-bold text-white mb-1">
        {mode === "login" ? t.auth.welcomeBack : t.auth.joinGroup}
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        {mode === "login" ? t.auth.loginSubtitle : t.auth.registerSubtitle}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="label">{t.auth.name}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={t.auth.namePlaceholder}
              />
            </div>
            <div>
              <label className="label">{t.auth.inviteCode}</label>
              <input
                className="input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                placeholder={t.auth.invitePlaceholder}
              />
            </div>
          </>
        )}

        <div>
          <label className="label">{t.auth.email}</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t.auth.emailPlaceholder}
          />
        </div>

        <div>
          <label className="label">{t.auth.password}</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input pr-20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-white"
            >
              {showPassword ? t.auth.hide : t.auth.show}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? t.auth.pleaseWait
            : mode === "login"
              ? t.nav.login
              : t.auth.createAccount}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {mode === "login" ? (
          <>
            {t.auth.noAccount}{" "}
            <Link href="/register" className="text-emerald-400 hover:underline">
              {t.nav.signup}
            </Link>
          </>
        ) : (
          <>
            {t.auth.hasAccount}{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              {t.nav.login}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
