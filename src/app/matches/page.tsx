import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { getServerI18n } from "@/i18n/server";
import { Navbar } from "@/components/Navbar";
import { MatchesClient } from "@/components/MatchesClient";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { dict: t } = await getServerI18n();

  const matches = await prisma.match.findMany({
    orderBy: { startTime: "asc" },
    include: {
      markets: {
        include: { options: { orderBy: { multiplier: "asc" } } },
        orderBy: { type: "asc" },
      },
      picks: {
        where: { userId: session.id },
        include: { market: true, marketOption: true },
      },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: session.id } });

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t.matches.title}</h1>
        <p className="text-slate-400 mb-8">{t.matches.subtitle}</p>
        <MatchesClient
          initialMatches={matches}
          userPoints={user?.points ?? 0}
          isAdmin={session.role === "ADMIN"}
        />
      </main>
    </div>
  );
}
