import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Singleton también en prod (contenedor long-lived) para no abrir pools extras. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

function isConnError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "P1001" ||
    code === "P1017" ||
    code === "P1002" ||
    /Can't reach database|Connection reset|ECONNRESET|ECONNREFUSED|server closed the connection|Connection terminated/i.test(
      msg
    )
  );
}

/**
 * Ejecuta una query Prisma con un reintento si Postgres reinició
 * (conexiones muertas tras redeploy de styleflix-db).
 */
export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isConnError(err)) throw err;
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    try {
      await prisma.$connect();
    } catch {
      /* next call may still fail */
    }
    return fn();
  }
}
