import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  adjustUserPoints,
  listUsersForAdmin,
  resetUserPassword,
  resetUserPoints,
  setUserLocked,
} from "@/lib/userAdmin";

export async function GET() {
  try {
    await requireAdmin();
    const users = await listUsersForAdmin();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("adjust_points"),
    userId: z.string(),
    amount: z.number().int(),
  }),
  z.object({
    action: z.literal("reset_points"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("reset_password"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("set_locked"),
    userId: z.string(),
    locked: z.boolean(),
  }),
]);

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = patchSchema.parse(body);

    switch (data.action) {
      case "adjust_points": {
        const user = await adjustUserPoints(data.userId, data.amount);
        return NextResponse.json({ success: true, user: { id: user.id, points: user.points } });
      }
      case "reset_points": {
        const user = await resetUserPoints(data.userId);
        return NextResponse.json({ success: true, user: { id: user.id, points: user.points } });
      }
      case "reset_password": {
        const { plainPassword } = await resetUserPassword(data.userId);
        return NextResponse.json({ success: true, password: plainPassword });
      }
      case "set_locked": {
        const user = await setUserLocked(data.userId, data.locked);
        return NextResponse.json({ success: true, user: { id: user.id, locked: user.locked } });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
