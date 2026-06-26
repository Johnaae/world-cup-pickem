"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";

export function HomeContent({ disclaimer }: { disclaimer: string }) {
  const { t } = useI18n();

  return (
    <main className="hero-gradient">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <div className="mb-6 text-6xl">⚽🏆</div>
        <h1 className="text-4xl font-black text-white sm:text-6xl">{t.nav.appName}</h1>
        <p className="mt-4 text-xl text-slate-400">{t.home.tagline}</p>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {disclaimer}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/login" className="btn-primary min-w-[160px]">{t.nav.login}</Link>
          <Link href="/register" className="btn-secondary min-w-[160px]">{t.nav.signup}</Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          <FeatureCard title={t.home.featurePointsTitle} desc={t.home.featurePointsDesc} />
          <FeatureCard title={t.home.featurePickTitle} desc={t.home.featurePickDesc} />
          <FeatureCard title={t.home.featureLeaderboardTitle} desc={t.home.featureLeaderboardDesc} />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card text-center sm:text-left">
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{desc}</p>
    </div>
  );
}
