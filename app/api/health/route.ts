import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness para Coolify / proxy.
 * ?ready=1 → Postgres
 * ?mail=1 → diagnóstico Resend/SMTP (sin filtrar secretos)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantReady = url.searchParams.get("ready") === "1";
  const wantMail = url.searchParams.get("mail") === "1";
  const started = Date.now();

  const body: Record<string, unknown> = {
    ok: true,
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    db: "skipped",
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
  }

  if (wantMail) {
    const { isMailConfigured } = await import("@/lib/mail");
    const { mailConfigSnapshot } = await import("@/lib/resend");
    const snap = mailConfigSnapshot();
    body.mail = {
      configured: isMailConfigured(),
      ...snap,
      tip: !snap.resendConfigured
        ? "Falta RESEND_API_KEY en Runtime de Coolify (debe empezar con re_). Redeploy tras agregarla."
        : "Key detectada. Si no llega correo: dominio verificado en Resend + DNS (SPF/DKIM) en Cloudflare, y revisá logs [mail] Resend error.",
    };
  }

  body.ms = Date.now() - started;
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
