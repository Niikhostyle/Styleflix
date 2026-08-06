-- Privacidad admin: quién otorgó el acceso
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "grantedByUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_grantedByUserId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_grantedByUserId_fkey"
      FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_grantedByUserId_idx" ON "User"("grantedByUserId");
