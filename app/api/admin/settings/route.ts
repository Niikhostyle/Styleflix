import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPreviewMinutes, setPreviewMinutes } from "@/lib/settings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const previewMinutes = await getPreviewMinutes();
  return NextResponse.json({ previewMinutes });
}

const patchSchema = z.object({
  previewMinutes: z.number().int().min(1).max(180),
});

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Minutos inválidos (1–180)." },
      { status: 400 }
    );
  }

  const previewMinutes = await setPreviewMinutes(parsed.data.previewMinutes);
  return NextResponse.json({ ok: true, previewMinutes });
}
