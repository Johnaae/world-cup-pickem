import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ user: session });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
