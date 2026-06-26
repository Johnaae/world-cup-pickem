import { prisma } from "./prisma";

const DEFAULT_DISCLAIMER =
  "Chỉ mang tính giải trí. Không cá cược tiền thật. Không thanh toán. Không có giải thưởng bằng tiền. Điểm không có giá trị quy đổi.";

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
