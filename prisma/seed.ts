import { PrismaClient, Role, MatchStatus, TransactionType, MarketType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createWinnerMarket(
  matchId: string,
  teamA: string,
  teamB: string,
  multipliers: { a: number; draw: number; b: number }
) {
  const market = await prisma.market.create({
    data: {
      matchId,
      type: MarketType.WINNER,
      label: "Winner",
      lastSyncedAt: new Date(),
    },
  });

  await prisma.marketOption.createMany({
    data: [
      { marketId: market.id, label: teamA, outcomeType: "TEAM_A", teamName: teamA, multiplier: multipliers.a },
      { marketId: market.id, label: "Draw", outcomeType: "DRAW", multiplier: multipliers.draw },
      { marketId: market.id, label: teamB, outcomeType: "TEAM_B", teamName: teamB, multiplier: multipliers.b },
    ],
  });

  return market;
}

async function createSampleMarkets(
  matchId: string,
  teamA: string,
  teamB: string,
  multipliers: { a: number; draw: number; b: number }
) {
  await createWinnerMarket(matchId, teamA, teamB, multipliers);

  const handicap = await prisma.market.create({
    data: { matchId, type: MarketType.HANDICAP, label: "Handicap", lastSyncedAt: new Date() },
  });
  await prisma.marketOption.createMany({
    data: [
      { marketId: handicap.id, label: `${teamA} -0.5`, outcomeType: "TEAM_A", teamName: teamA, pointLine: -0.5, multiplier: 1.8 },
      { marketId: handicap.id, label: `${teamB} +0.5`, outcomeType: "TEAM_B", teamName: teamB, pointLine: 0.5, multiplier: 1.9 },
    ],
  });

  const totals = await prisma.market.create({
    data: { matchId, type: MarketType.TOTAL_GOALS, label: "Total Goals", lastSyncedAt: new Date() },
  });
  await prisma.marketOption.createMany({
    data: [
      { marketId: totals.id, label: "Over 2.5", outcomeType: "OVER", pointLine: 2.5, multiplier: 1.85 },
      { marketId: totals.id, label: "Under 2.5", outcomeType: "UNDER", pointLine: 2.5, multiplier: 1.85 },
    ],
  });

  const correctScore = await prisma.market.create({
    data: { matchId, type: MarketType.CORRECT_SCORE, label: "Correct Score", lastSyncedAt: new Date() },
  });
  await prisma.marketOption.createMany({
    data: [
      { marketId: correctScore.id, label: "1-0", outcomeType: "CORRECT_SCORE", correctScoreA: 1, correctScoreB: 0, multiplier: 8.0 },
      { marketId: correctScore.id, label: "1-1", outcomeType: "CORRECT_SCORE", correctScoreA: 1, correctScoreB: 1, multiplier: 6.5 },
      { marketId: correctScore.id, label: "2-1", outcomeType: "CORRECT_SCORE", correctScoreA: 2, correctScoreB: 1, multiplier: 9.0 },
      { marketId: correctScore.id, label: "0-0", outcomeType: "CORRECT_SCORE", correctScoreA: 0, correctScoreB: 0, multiplier: 10.0 },
    ],
  });
}

async function main() {
  console.log("Seeding database...");

  await prisma.pointsTransaction.deleteMany();
  await prisma.pick.deleteMany();
  await prisma.marketOption.deleteMany();
  await prisma.market.deleteMany();
  await prisma.match.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSettings.deleteMany();

  const settings = await prisma.appSettings.create({
    data: {
      id: "default",
      startingPoints: 1000,
      inviteCode: "WORLDCUP2026",
      disclaimer:
        "Chỉ mang tính giải trí. Không cá cược tiền thật. Không thanh toán. Không có giải thưởng bằng tiền. Điểm không có giá trị quy đổi.",
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
        data: { ...u, passwordHash, points: settings.startingPoints },
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

  const matchData = [
    { teamA: "Brazil", teamB: "Argentina", startTime: new Date(now.getTime() + 2 * day), status: MatchStatus.UPCOMING, multiplierTeamA: 2.5, multiplierDraw: 3.0, multiplierTeamB: 1.5 },
    { teamA: "France", teamB: "Germany", startTime: new Date(now.getTime() + 3 * day), status: MatchStatus.UPCOMING, multiplierTeamA: 1.8, multiplierDraw: 3.0, multiplierTeamB: 2.0 },
    { teamA: "Spain", teamB: "Italy", startTime: new Date(now.getTime() + 4 * day), status: MatchStatus.UPCOMING, multiplierTeamA: 1.6, multiplierDraw: 3.2, multiplierTeamB: 2.2 },
    { teamA: "England", teamB: "Portugal", startTime: new Date(now.getTime() - 2 * day), status: MatchStatus.FINISHED, scoreA: 2, scoreB: 1, scoreHalfA: 1, scoreHalfB: 0, multiplierTeamA: 1.5, multiplierDraw: 3.0, multiplierTeamB: 2.5 },
    { teamA: "Netherlands", teamB: "Belgium", startTime: new Date(now.getTime() - 1 * day), status: MatchStatus.FINISHED, scoreA: 1, scoreB: 1, scoreHalfA: 0, scoreHalfB: 1, multiplierTeamA: 2.0, multiplierDraw: 2.8, multiplierTeamB: 2.0 },
    { teamA: "USA", teamB: "Mexico", startTime: new Date(now.getTime() + 1 * day), status: MatchStatus.UPCOMING, multiplierTeamA: 2.2, multiplierDraw: 3.0, multiplierTeamB: 1.7 },
  ];

  for (const m of matchData) {
    const match = await prisma.match.create({ data: m });
    await createSampleMarkets(match.id, match.teamA, match.teamB, {
      a: m.multiplierTeamA,
      draw: m.multiplierDraw,
      b: m.multiplierTeamB,
    });
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
