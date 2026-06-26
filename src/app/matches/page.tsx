import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { MatchesClient } from "@/components/MatchesClient";

export default async function MatchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const matches = await prisma.match.findMany({
    orderBy: { startTime: "asc" },
    include: {
      picks: { where: { userId: session.id }, take: 1 },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: session.id } });

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Matches</h1>
        <p className="text-slate-400 mb-8">Pick outcomes before kickoff. Points are virtual only.</p>
        <MatchesClient initialMatches={matches} userPoints={user?.points ?? 0} />
      </main>
    </div>
  );
}
