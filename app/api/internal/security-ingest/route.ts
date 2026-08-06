import { NextResponse } from "next/server";
import {
  maybeAutoBlockFromScans,
  recordSecurityEvent,
  type SecurityEventType,
} from "@/lib/security";

/**
 * Ingest de señales de seguridad desde middleware (edge).
 * Auth: prefijo de AUTH_SECRET en header x-veotv-ingest.
 */
export async function POST(request: Request) {
  const secret = (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  ).trim();
  const got = request.headers.get("x-veotv-ingest") || "";
  if (!secret || got !== secret.slice(0, 32)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: SecurityEventType;
    severity?: string;
    ip?: string;
    path?: string;
    method?: string;
    userAgent?: string;
    detail?: string;
  } | null;

  if (!body?.type) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await recordSecurityEvent({
    type: body.type,
    severity: body.severity || "medium",
    ip: body.ip,
    path: body.path,
    method: body.method,
    userAgent: body.userAgent,
    detail: body.detail,
  });

  if (body.type === "SCAN" && body.ip) {
    await maybeAutoBlockFromScans(body.ip);
  }

  return NextResponse.json({ ok: true });
}
