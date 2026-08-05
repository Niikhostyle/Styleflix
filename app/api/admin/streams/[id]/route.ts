import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

function isHttpsUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

const patchSchema = z.object({
  mediaType: z.enum(["movie", "tv"]).optional(),
  tmdbId: z.number().int().positive().optional(),
  season: z.number().int().min(0).max(100).nullable().optional(),
  episode: z.number().int().min(0).max(500).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  embedUrl: z.string().url().max(2000).optional(),
  label: z.string().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.streamOverride.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.embedUrl != null && !isHttpsUrl(data.embedUrl)) {
    return NextResponse.json(
      { error: "El link debe ser una URL https válida." },
      { status: 400 }
    );
  }

  const mediaType = data.mediaType ?? existing.mediaType;
  const season =
    mediaType === "movie"
      ? null
      : data.season !== undefined
        ? data.season
        : existing.season;
  const episode =
    mediaType === "movie"
      ? null
      : data.episode !== undefined
        ? data.episode
        : existing.episode;

  const row = await prisma.streamOverride.update({
    where: { id },
    data: {
      ...(data.mediaType != null ? { mediaType: data.mediaType } : {}),
      ...(data.tmdbId != null ? { tmdbId: data.tmdbId } : {}),
      season,
      episode,
      ...(data.title !== undefined
        ? { title: data.title?.trim() || null }
        : {}),
      ...(data.embedUrl != null ? { embedUrl: data.embedUrl.trim() } : {}),
      ...(data.label != null
        ? { label: data.label.trim().slice(0, 60) }
        : {}),
      ...(data.enabled != null ? { enabled: data.enabled } : {}),
      ...(data.priority != null ? { priority: data.priority } : {}),
      ...(data.notes !== undefined
        ? { notes: data.notes?.trim() || null }
        : {}),
    },
  });

  return NextResponse.json({ item: row });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.streamOverride.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
