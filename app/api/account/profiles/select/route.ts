import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clearSelectedProfileCookie,
  setSelectedProfileCookie,
} from "@/lib/profiles";

const schema = z.object({
  profileId: z.string().min(1).nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const id = jar.get("veotv_profile")?.value || null;
  if (!id) {
    return NextResponse.json({ profile: null });
  }

  const profile = await prisma.profile.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      name: true,
      avatarKey: true,
      isKids: true,
    },
  });

  if (!profile) {
    await clearSelectedProfileCookie();
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  if (!parsed.data.profileId) {
    await clearSelectedProfileCookie();
    return NextResponse.json({ ok: true, profile: null });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: parsed.data.profileId, userId: session.user.id },
    select: {
      id: true,
      name: true,
      avatarKey: true,
      isKids: true,
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
  }

  await setSelectedProfileCookie(profile.id);
  return NextResponse.json({ ok: true, profile });
}
