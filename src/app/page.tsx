import Link from "next/link";
import { getAppSettings } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";

export default async function HomePage() {
  const settings = await getAppSettings();

  return (
    <div className="min-h-screen">
      <Navbar user={null} />
      <main className="hero-gradient">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <div className="mb-6 text-6xl">⚽🏆</div>
          <h1 className="text-4xl font-black text-white sm:text-6xl">
            World Cup Pick&apos;em
          </h1>
          <p className="mt-4 text-xl text-slate-400">
            Private prediction game for friends
          </p>

          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {settings.disclaimer}
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="btn-primary min-w-[160px]">
              Log In
            </Link>
            <Link href="/register" className="btn-secondary min-w-[160px]">
              Sign Up
            </Link>
          </div>

          <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
            <FeatureCard title="1,000 Points" desc="Everyone starts with virtual points to play for fun." />
            <FeatureCard title="Pick Outcomes" desc="Choose a winner or draw and risk points with multipliers." />
            <FeatureCard title="Leaderboard" desc="Climb the ranks with friends — bragging rights only!" />
          </div>
        </div>
      </main>
    </div>
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
