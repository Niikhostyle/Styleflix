import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensurePrimaryProfile, listProfiles } from "@/lib/profiles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await ensurePrimaryProfile({
    userId: session.user.id,
    name: session.user.name || "Principal",
  });

  const profiles = await listProfiles(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planMaxProfiles: true },
  });

  return NextResponse.json({
    profiles,
    maxProfiles: user?.planMaxProfiles ?? 1,
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  avatarKey: z.string().max(8).optional(),
  isKids: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planMaxProfiles: true, name: true },
  });
  const max = user?.planMaxProfiles ?? 1;
  const count = await prisma.profile.count({
    where: { userId: session.user.id },
  });
  if (count >= max) {
    return NextResponse.json(
      {
        error: `Tu plan permite hasta ${max} perfil${max === 1 ? "" : "es"}. Mejora tu plan para agregar más.`,
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });
  }

  const profile = await prisma.profile.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name.trim(),
      avatarKey: parsed.data.avatarKey || String((count % 5) + 1),
      isKids: Boolean(parsed.data.isKids),
      sortOrder: count,
    },
  });

  return NextResponse.json({ ok: true, profile });
}
