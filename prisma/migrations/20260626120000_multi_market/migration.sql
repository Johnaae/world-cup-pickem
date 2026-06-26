-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('WINNER', 'HANDICAP', 'TOTAL_GOALS', 'FIRST_HALF_WINNER', 'FIRST_HALF_HANDICAP', 'FIRST_HALF_TOTAL_GOALS', 'CORRECT_SCORE');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "scoreHalfA" INTEGER,
ADD COLUMN "scoreHalfB" INTEGER;

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN "marketId" TEXT,
ADD COLUMN "marketOptionId" TEXT,
ALTER COLUMN "selectedOutcome" DROP NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Pick_userId_matchId_key";

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "MarketType" NOT NULL,
    "label" TEXT NOT NULL,
    "bookmaker" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOption" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "teamName" TEXT,
    "pointLine" DOUBLE PRECISION,
    "correctScoreA" INTEGER,
    "correctScoreB" INTEGER,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_matchId_type_key" ON "Market"("matchId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOption_marketId_label_pointLine_key" ON "MarketOption"("marketId", "label", "pointLine");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_userId_marketId_key" ON "Pick"("userId", "marketId");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOption" ADD CONSTRAINT "MarketOption_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_marketOptionId_fkey" FOREIGN KEY ("marketOptionId") REFERENCES "MarketOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
