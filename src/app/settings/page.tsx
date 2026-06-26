import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { SettingsClient } from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen">
      <Navbar user={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <SettingsClient
          initialSettings={{
            startingPoints: settings.startingPoints,
            disclaimer: settings.disclaimer,
            inviteCode: settings.inviteCode,
          }}
        />
      </main>
    </div>
  );
}
