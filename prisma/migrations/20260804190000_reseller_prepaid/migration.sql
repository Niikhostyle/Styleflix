-- AlterTable: cuentas revendedor con activación al primer uso
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planSource" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "prepaidDays" INTEGER;
