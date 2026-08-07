import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness para Coolify / proxy.
 * ?ready=1 también verifica Postgres (SELECT 1) con timeout corto.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantReady = url.searchParams.get("ready") === "1";
  const started = Date.now();

  const body: {
    ok: boolean;
    status: "ok" | "degraded";
    uptimeSec: number;
    db?: "up" | "down" | "skipped";
    ms: number;
  } = {
    ok: true,
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    ms: 0,
  };

  if (wantReady) {
    body.db = "down";
    try {
      const { prisma } = await import("@/lib/prisma");
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("db-timeout")), 2500)
        ),
      ]);
      body.db = "up";
    } catch {
      body.ok = false;
      body.status = "degraded";
      body.db = "down";
    }
  } else {
    body.db = "skipped";
  }

  body.ms = Date.now() - started;
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
