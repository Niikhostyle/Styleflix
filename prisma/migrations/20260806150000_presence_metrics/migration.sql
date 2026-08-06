-- Presencia / métricas de actividad
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastIp" TEXT;

CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "PresenceSession" (
  "id" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "userId" TEXT,
  "ip" TEXT NOT NULL,
  "userAgent" TEXT,
  "path" TEXT,
  "country" TEXT,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PresenceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PresenceSession_sessionKey_key" ON "PresenceSession"("sessionKey");
CREATE INDEX IF NOT EXISTS "PresenceSession_lastSeenAt_idx" ON "PresenceSession"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "PresenceSession_userId_lastSeenAt_idx" ON "PresenceSession"("userId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "PresenceSession_ip_lastSeenAt_idx" ON "PresenceSession"("ip", "lastSeenAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PresenceSession_userId_fkey'
  ) THEN
    ALTER TABLE "PresenceSession"
      ADD CONSTRAINT "PresenceSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
