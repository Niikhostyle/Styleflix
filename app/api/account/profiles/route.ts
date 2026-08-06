import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ensurePrimaryProfile,
  getEffectiveMaxProfiles,
  listProfiles,
} from "@/lib/profiles";
import { normalizeAvatarKey } from "@/lib/profile-avatars";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function GET() {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      name: true,
      planMaxProfiles: true,
      planTier: true,
    },
  });

  await ensurePrimaryProfile({
    userId: session.user.id,
    name: session.user.name || dbUser?.name || "Principal",
  });

  const profiles = await listProfiles(session.user.id);
  const maxProfiles = await getEffectiveMaxProfiles({
    id: session.user.id,
    role: dbUser?.role || session.user.role,
    planMaxProfiles: dbUser?.planMaxProfiles,
    planTier: dbUser?.planTier || session.user.planTier,
  });

  // Si tiene más perfiles que el plan actual, no borramos; solo bloqueamos crear más
  return NextResponse.json({
    profiles,
    maxProfiles,
    streamsPerProfile: 1,
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  avatarKey: z.string().max(8).optional(),
  isKids: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      planMaxProfiles: true,
      planTier: true,
      name: true,
    },
  });
  const max = await getEffectiveMaxProfiles({
    id: session.user.id,
    role: dbUser?.role || session.user.role,
    planMaxProfiles: dbUser?.planMaxProfiles,
    planTier: dbUser?.planTier || session.user.planTier,
  });
  const count = await prisma.profile.count({
    where: { userId: session.user.id },
  });
  if (count >= max) {
    return NextResponse.json(
      {
        error: `Tu plan permite hasta ${max} perfil${max === 1 ? "" : "es"}. Cada perfil = 1 pantalla en simultáneo.`,
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
      avatarKey: normalizeAvatarKey(
        parsed.data.avatarKey || String((count % 8) + 1)
      ),
      isKids: Boolean(parsed.data.isKids),
      sortOrder: count,
    },
  });

  return NextResponse.json({ ok: true, profile });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40).optional(),
  avatarKey: z.string().max(8).optional(),
  isKids: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const owned = await prisma.profile.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const profile = await prisma.profile.update({
    where: { id: owned.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.avatarKey
        ? { avatarKey: normalizeAvatarKey(parsed.data.avatarKey) }
        : {}),
      ...(typeof parsed.data.isKids === "boolean"
        ? { isKids: parsed.data.isKids }
        : {}),
    },
  });
  return NextResponse.json({ ok: true, profile });
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(request: Request) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const count = await prisma.profile.count({
    where: { userId: session.user.id },
  });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Debes conservar al menos un perfil." },
      { status: 400 }
    );
  }

  const owned = await prisma.profile.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  await prisma.profile.delete({ where: { id: owned.id } });
  return NextResponse.json({ ok: true });
}
