-- CreateTable
CREATE TABLE "StreamOverride" (
    "id" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "title" TEXT,
    "embedUrl" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'VeoTV',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamOverride_mediaType_tmdbId_enabled_idx" ON "StreamOverride"("mediaType", "tmdbId", "enabled");

-- CreateIndex
CREATE INDEX "StreamOverride_tmdbId_idx" ON "StreamOverride"("tmdbId");
