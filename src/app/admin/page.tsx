import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { getServerI18n } from "@/i18n/server";
import { Navbar } from "@/components/Navbar";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");
  const { dict: t } = await getServerI18n();

  const [matches, settings] = await Promise.all([
    prisma.match.findMany({
      orderBy: { startTime: "asc" },
      include: {
        markets: { include: { options: true }, orderBy: { type: "asc" } },
        picks: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            market: true,
            marketOption: true,
          },
        },
      },
    }),
    getAppSettings(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t.admin.title}</h1>
        <p className="text-slate-400 mb-8">{t.admin.subtitle}</p>
        <AdminClient
          initialMatches={matches}
          lastSyncedAt={settings.lastOddsSyncAt?.toISOString() ?? null}
        />
      </main>
    </div>
  );
}
