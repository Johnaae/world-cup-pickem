-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "lastOddsSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "oddsApiId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_oddsApiId_key" ON "Match"("oddsApiId");
