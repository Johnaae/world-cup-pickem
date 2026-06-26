import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getServerI18n } from "@/i18n/server";
import { Navbar } from "@/components/Navbar";
import { AdminUsersClient } from "@/components/AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");
  const { dict: t } = await getServerI18n();

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.adminUsers.title}</h1>
            <p className="text-slate-400">{t.adminUsers.subtitle}</p>
          </div>
          <Link href="/admin" className="btn-secondary text-sm">{t.nav.backAdmin}</Link>
        </div>
        <AdminUsersClient />
      </main>
    </div>
  );
}
