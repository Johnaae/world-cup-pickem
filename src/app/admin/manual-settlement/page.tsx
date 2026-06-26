import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerI18n } from "@/i18n/server";
import { Navbar } from "@/components/Navbar";
import { ManualSettlementClient } from "@/components/ManualSettlementClient";
import { PickStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ManualSettlementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");
  const { dict: t } = await getServerI18n();

  const matches = await prisma.match.findMany({
    where: {
      markets: {
        some: {
          settledAt: null,
          options: { some: {} },
        },
      },
    },
    orderBy: { startTime: "desc" },
    include: {
      markets: {
        where: { settledAt: null },
        include: {
          options: { orderBy: { label: "asc" } },
          picks: {
            where: { status: PickStatus.PENDING },
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { type: "asc" },
      },
    },
  });

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.manualSettlement.title}</h1>
            <p className="text-slate-400">{t.manualSettlement.subtitle}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="btn-secondary text-sm">{t.nav.backAdmin}</Link>
            <Link href="/admin/manual-markets" className="btn-secondary text-sm">{t.nav.manualMarkets}</Link>
          </div>
        </div>
        <ManualSettlementClient initialMatches={matches} />
      </main>
    </div>
  );
}
