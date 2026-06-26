-- AlterTable
ALTER TABLE "MarketOption" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "MarketOption" ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OddsHistory" (
    "id" TEXT NOT NULL,
    "marketOptionId" TEXT NOT NULL,
    "oldMultiplier" DOUBLE PRECISION NOT NULL,
    "newMultiplier" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "OddsProvider" NOT NULL,
    "note" TEXT,

    CONSTRAINT "OddsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OddsHistory_marketOptionId_changedAt_idx" ON "OddsHistory"("marketOptionId", "changedAt");

-- AddForeignKey
ALTER TABLE "OddsHistory" ADD CONSTRAINT "OddsHistory_marketOptionId_fkey" FOREIGN KEY ("marketOptionId") REFERENCES "MarketOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
