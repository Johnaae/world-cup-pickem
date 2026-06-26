import Link from "next/link";
import { getAppSettings } from "@/lib/settings";
import { getServerI18n } from "@/i18n/server";
import { Navbar } from "@/components/Navbar";
import { HomeContent } from "@/components/HomeContent";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getAppSettings();
  const { dict: t } = await getServerI18n();
  const disclaimer = settings.disclaimer || t.disclaimer.full;

  return (
    <div className="min-h-screen">
      <Navbar user={null} />
      <HomeContent disclaimer={disclaimer} />
    </div>
  );
}
