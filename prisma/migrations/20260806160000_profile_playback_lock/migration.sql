-- Lock de reproducción: 1 stream por perfil
CREATE TABLE IF NOT EXISTS "ProfilePlaybackLock" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "lockToken" TEXT NOT NULL,
  "titleLabel" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfilePlaybackLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfilePlaybackLock_profileId_key" ON "ProfilePlaybackLock"("profileId");
CREATE INDEX IF NOT EXISTS "ProfilePlaybackLock_userId_idx" ON "ProfilePlaybackLock"("userId");
CREATE INDEX IF NOT EXISTS "ProfilePlaybackLock_deviceId_idx" ON "ProfilePlaybackLock"("deviceId");
CREATE INDEX IF NOT EXISTS "ProfilePlaybackLock_lastHeartbeat_idx" ON "ProfilePlaybackLock"("lastHeartbeat");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProfilePlaybackLock_profileId_fkey'
  ) THEN
    ALTER TABLE "ProfilePlaybackLock"
      ADD CONSTRAINT "ProfilePlaybackLock_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
