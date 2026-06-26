import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { TransactionType } from "@prisma/client";

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  inviteCode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);
    const settings = await getAppSettings();

    if (data.inviteCode !== settings.inviteCode) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        points: settings.startingPoints,
      },
    });

    await prisma.pointsTransaction.create({
      data: {
        userId: user.id,
        type: TransactionType.INITIAL,
        amount: settings.startingPoints,
        balanceAfter: settings.startingPoints,
        note: "Starting points",
      },
    });

    await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, points: user.points },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (user.locked) {
      return NextResponse.json({ error: "Account is locked" }, { status: 403 });
    }

    await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, points: user.points },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
