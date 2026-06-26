import { PrismaClient, Role, MatchStatus, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.pointsTransaction.deleteMany();
  await prisma.pick.deleteMany();
  await prisma.match.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSettings.deleteMany();

  const settings = await prisma.appSettings.create({
    data: {
      id: "default",
      startingPoints: 1000,
      inviteCode: "WORLDCUP2026",
      disclaimer:
        "For entertainment purposes only. No real-money betting. No payments. No cash prizes. Points have no monetary value.",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@pickem.local",
      passwordHash,
      role: Role.ADMIN,
      points: settings.startingPoints,
    },
  });

  const users = await Promise.all(
    [
      { name: "Alex", email: "alex@pickem.local" },
      { name: "Jordan", email: "jordan@pickem.local" },
      { name: "Sam", email: "sam@pickem.local" },
      { name: "Casey", email: "casey@pickem.local" },
    ].map((u) =>
      prisma.user.create({
        data: {
          ...u,
          passwordHash,
          points: settings.startingPoints,
        },
      })
    )
  );

  const allUsers = [admin, ...users];
  for (const user of allUsers) {
    await prisma.pointsTransaction.create({
      data: {
        userId: user.id,
        type: TransactionType.INITIAL,
        amount: settings.startingPoints,
        balanceAfter: settings.startingPoints,
        note: "Starting points",
      },
    });
  }

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const matches = [
    {
      teamA: "Brazil",
      teamB: "Argentina",
      startTime: new Date(now.getTime() + 2 * day),
      status: MatchStatus.UPCOMING,
      multiplierTeamA: 2.5,
      multiplierDraw: 3.0,
      multiplierTeamB: 1.5,
    },
    {
      teamA: "France",
      teamB: "Germany",
      startTime: new Date(now.getTime() + 3 * day),
      status: MatchStatus.UPCOMING,
      multiplierTeamA: 1.8,
      multiplierDraw: 3.0,
      multiplierTeamB: 2.0,
    },
    {
      teamA: "Spain",
      teamB: "Italy",
      startTime: new Date(now.getTime() + 4 * day),
      status: MatchStatus.UPCOMING,
      multiplierTeamA: 1.6,
      multiplierDraw: 3.2,
      multiplierTeamB: 2.2,
    },
    {
      teamA: "England",
      teamB: "Portugal",
      startTime: new Date(now.getTime() - 2 * day),
      status: MatchStatus.FINISHED,
      scoreA: 2,
      scoreB: 1,
      multiplierTeamA: 1.5,
      multiplierDraw: 3.0,
      multiplierTeamB: 2.5,
    },
    {
      teamA: "Netherlands",
      teamB: "Belgium",
      startTime: new Date(now.getTime() - 1 * day),
      status: MatchStatus.FINISHED,
      scoreA: 1,
      scoreB: 1,
      multiplierTeamA: 2.0,
      multiplierDraw: 2.8,
      multiplierTeamB: 2.0,
    },
    {
      teamA: "USA",
      teamB: "Mexico",
      startTime: new Date(now.getTime() + 1 * day),
      status: MatchStatus.UPCOMING,
      multiplierTeamA: 2.2,
      multiplierDraw: 3.0,
      multiplierTeamB: 1.7,
    },
  ];

  for (const match of matches) {
    await prisma.match.create({ data: match });
  }

  console.log("Seed complete!");
  console.log("");
  console.log("Invite code: WORLDCUP2026");
  console.log("Admin login: admin@pickem.local / password123");
  console.log("User login:  alex@pickem.local / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
