import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { AdminClient } from "@/components/AdminClient";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const [matches, settings] = await Promise.all([
    prisma.match.findMany({
      orderBy: { startTime: "asc" },
      include: {
        picks: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    getAppSettings(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-slate-400 mb-8">Manage matches, enter results, and recalculate points.</p>
        <AdminClient
          initialMatches={matches}
          lastSyncedAt={settings.lastOddsSyncAt?.toISOString() ?? null}
        />
      </main>
    </div>
  );
}
