import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clientIpFromHeaders } from "@/lib/security";
import { touchPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
  };

  const ip = clientIpFromHeaders(request.headers);
  const ua = request.headers.get("user-agent");
  const country =
    request.headers.get("cf-ipcountry")?.trim().toUpperCase() || null;

  await touchPresence({
    userId: session.user.id,
    ip,
    userAgent: ua,
    path: typeof body.path === "string" ? body.path : null,
    country: country && country.length === 2 ? country : null,
  });

  return NextResponse.json({ ok: true });
}
