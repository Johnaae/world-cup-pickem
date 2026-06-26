import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";

const schema = z.object({ locale: z.enum(["vi", "en"]) });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locale } = schema.parse(body);
    const response = NextResponse.json({ success: true, locale });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE)?.value;
  return NextResponse.json({ locale: isLocale(locale) ? locale : "vi" });
}
