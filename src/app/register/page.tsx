import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { AuthForm } from "@/components/AuthForm";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <Navbar user={null} />
      <main className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-8">
        <AuthForm mode="register" />
      </main>
    </div>
  );
}
