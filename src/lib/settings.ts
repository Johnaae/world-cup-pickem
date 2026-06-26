import { prisma } from "./prisma";

const DEFAULT_DISCLAIMER =
  "For entertainment purposes only. No real-money betting. No payments. No cash prizes. Points have no monetary value.";

export async function getAppSettings() {
  let settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        id: "default",
        startingPoints: 1000,
        disclaimer: DEFAULT_DISCLAIMER,
        inviteCode: "WORLDCUP2026",
      },
    });
  }
  return settings;
}
