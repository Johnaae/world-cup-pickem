"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

type NavbarProps = {
  user: SessionUser | null;
};

export function Navbar({ user }: NavbarProps) {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <span className="font-bold text-white">World Cup Pick&apos;em</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline text-emerald-400 font-semibold">
                {user.points.toLocaleString()} pts
              </span>
              <Link href="/dashboard" className="nav-link">Dashboard</Link>
              <Link href="/matches" className="nav-link">Matches</Link>
              <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
              {user.role === "ADMIN" && (
                <>
                  <Link href="/admin" className="nav-link">Admin</Link>
                  <Link href="/admin/manual-markets" className="nav-link hidden lg:inline">Manual Markets</Link>
                  <Link href="/settings" className="nav-link">Settings</Link>
                </>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">Login</Link>
              <Link href="/register" className="btn-primary text-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        window.location.href = "/";
      }}
      className="text-slate-400 hover:text-white text-sm"
    >
      Logout
    </button>
  );
}
