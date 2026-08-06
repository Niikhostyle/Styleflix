import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIpFromHeaders,
  maybeAutoBlockFromAuthFails,
  recordSecurityEvent,
} from "@/lib/security";

const schema = z.object({
  email: z.string().email().optional(),
  reason: z.string().max(120).optional(),
});

/** Registra fallos de login (desde el cliente) para el panel de seguridad. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ip = clientIpFromHeaders(request.headers);
  const ua = request.headers.get("user-agent");
  await recordSecurityEvent({
    type: "AUTH_FAIL",
    severity: "medium",
    ip,
    path: "/login",
    method: "POST",
    userAgent: ua,
    detail: parsed.data.reason || "Credenciales inválidas",
    meta: parsed.data.email
      ? { email: parsed.data.email.toLowerCase() }
      : undefined,
  });
  await maybeAutoBlockFromAuthFails(ip);
  return NextResponse.json({ ok: true });
}
