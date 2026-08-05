-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planTier" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planPeriod" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planMaxProfiles" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planMaxResolution" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planFeatures" JSONB;

-- AlterTable Payment amount precision
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarKey" TEXT NOT NULL DEFAULT '1',
    "isKids" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Profile_userId_sortOrder_idx" ON "Profile"("userId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
