"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { useI18n } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavbarProps = {
  user: SessionUser | null;
};

export function Navbar({ user }: NavbarProps) {
  const { t } = useI18n();

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <span className="font-bold text-white">{t.nav.appName}</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher compact />
          {user ? (
            <>
              <span className="hidden sm:inline text-emerald-400 font-semibold">
                {user.points.toLocaleString()} {t.nav.points}
              </span>
              <Link href="/dashboard" className="nav-link">{t.nav.dashboard}</Link>
              <Link href="/matches" className="nav-link">{t.nav.matches}</Link>
              <Link href="/leaderboard" className="nav-link">{t.nav.leaderboard}</Link>
              {user.role === "ADMIN" && (
                <>
                  <Link href="/admin" className="nav-link">{t.nav.admin}</Link>
                  <Link href="/admin/users" className="nav-link hidden lg:inline">{t.nav.manageUsers}</Link>
                  <Link href="/admin/manual-markets" className="nav-link hidden lg:inline">{t.nav.manualMarkets}</Link>
                  <Link href="/admin/import-image" className="nav-link hidden xl:inline">{t.nav.importImageMarkets}</Link>
                  <Link href="/settings" className="nav-link">{t.nav.settings}</Link>
                </>
              )}
              <LogoutButton label={t.nav.logout} />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">{t.nav.login}</Link>
              <Link href="/register" className="btn-primary text-sm">{t.nav.signup}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function LogoutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        window.location.href = "/";
      }}
      className="text-slate-400 hover:text-white text-sm"
    >
      {label}
    </button>
  );
}
