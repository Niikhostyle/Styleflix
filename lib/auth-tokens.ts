import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type AuthTokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken() {
  return randomBytes(32).toString("hex");
}

/** Crea un token de un solo uso; invalida los anteriores del mismo tipo. */
export async function issueAuthToken(opts: {
  userId: string;
  type: AuthTokenType;
  /** horas de validez */
  ttlHours: number;
}) {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + opts.ttlHours * 60 * 60 * 1000);

  await prisma.authToken.updateMany({
    where: {
      userId: opts.userId,
      type: opts.type,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  await prisma.authToken.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      tokenHash,
      expiresAt,
    },
  });

  return { raw, expiresAt };
}

export async function consumeAuthToken(opts: {
  raw: string;
  type: AuthTokenType;
}) {
  const tokenHash = hashToken(opts.raw);
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.type !== opts.type) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await prisma.authToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return row.user;
}
