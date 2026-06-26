import { PickStatus, TransactionType } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { getAppSettings } from "./settings";

function randomNumericPassword(): string {
  const length = 6 + Math.floor(Math.random() * 3);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += Math.floor(Math.random() * 10).toString();
  }
  return password;
}

export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      points: true,
      locked: true,
      createdAt: true,
      picks: { select: { status: true } },
    },
  });

  return users.map((u) => {
    const wins = u.picks.filter((p) => p.status === PickStatus.WON).length;
    const losses = u.picks.filter((p) => p.status === PickStatus.LOST).length;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      points: u.points,
      locked: u.locked,
      wins,
      losses,
      totalPicks: u.picks.length,
      createdAt: u.createdAt.toISOString(),
    };
  });
}

export async function adjustUserPoints(userId: string, amount: number, note?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role === "ADMIN") throw new Error("Cannot adjust admin points");

    const updated = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: TransactionType.ADMIN_ADJUSTMENT,
        amount,
        balanceAfter: updated.points,
        note: note ?? (amount >= 0 ? "Admin increased points" : "Admin decreased points"),
      },
    });

    return updated;
  });
}

export async function resetUserPoints(userId: string) {
  const settings = await getAppSettings();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role === "ADMIN") throw new Error("Cannot reset admin points");

    const adjustment = settings.startingPoints - user.points;
    const updated = await tx.user.update({
      where: { id: userId },
      data: { points: settings.startingPoints },
    });

    if (adjustment !== 0) {
      await tx.pointsTransaction.create({
        data: {
          userId,
          type: TransactionType.ADMIN_ADJUSTMENT,
          amount: adjustment,
          balanceAfter: updated.points,
          note: "Admin reset points",
        },
      });
    }

    return updated;
  });
}

export async function resetUserPassword(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.role === "ADMIN") throw new Error("Cannot reset admin password");

  const plainPassword = randomNumericPassword();
  const passwordHash = await hashPassword(plainPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { plainPassword };
}

export async function setUserLocked(userId: string, locked: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.role === "ADMIN") throw new Error("Cannot lock admin account");

  return prisma.user.update({
    where: { id: userId },
    data: { locked },
  });
}

export { randomNumericPassword };
