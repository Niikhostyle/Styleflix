-- CreateTable
CREATE TABLE "TitleRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TitleRequest_status_createdAt_idx" ON "TitleRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TitleRequest_userId_mediaType_tmdbId_key" ON "TitleRequest"("userId", "mediaType", "tmdbId");

-- AddForeignKey
ALTER TABLE "TitleRequest" ADD CONSTRAINT "TitleRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
