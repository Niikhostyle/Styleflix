import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import {
  blockIp,
  getSecurityDashboard,
  unblockIp,
} from "@/lib/security";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const hours = Math.min(
    168,
    Math.max(1, Number(new URL(request.url).searchParams.get("hours") || "24") || 24)
  );
  const data = await getSecurityDashboard(hours);
  return NextResponse.json(data);
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block"),
    ip: z.string().min(3).max(64),
    reason: z.string().max(300).optional(),
    ttlHours: z.number().int().min(1).max(8760).nullable().optional(),
  }),
  z.object({
    action: z.literal("unblock"),
    ip: z.string().min(3).max(64),
  }),
]);

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  if (parsed.data.action === "block") {
    const row = await blockIp({
      ip: parsed.data.ip,
      reason: parsed.data.reason || "Bloqueo manual (admin)",
      source: "MANUAL",
      ttlHours: parsed.data.ttlHours ?? null,
    });
    return NextResponse.json({ ok: true, blocked: row });
  }
  await unblockIp(parsed.data.ip);
  return NextResponse.json({ ok: true });
}
