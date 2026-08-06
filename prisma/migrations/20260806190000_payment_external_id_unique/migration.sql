-- Deduplicar externalId antes del unique (conserva el pago más antiguo).
DELETE FROM "Payment" a
USING "Payment" b
WHERE a."externalId" IS NOT NULL
  AND a."externalId" = b."externalId"
  AND a."id" <> b."id"
  AND a."createdAt" > b."createdAt";

DROP INDEX IF EXISTS "Payment_externalId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_externalId_key"
  ON "Payment"("externalId");
