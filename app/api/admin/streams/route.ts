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

const bodySchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  season: z.number().int().min(0).max(100).nullable().optional(),
  episode: z.number().int().min(0).max(500).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  embedUrl: z.string().url().max(2000),
  label: z.string().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const tmdbRaw = searchParams.get("tmdb");
  const tmdbId = tmdbRaw ? Number(tmdbRaw) : null;
  const mediaType = searchParams.get("type");

  const rows = await prisma.streamOverride.findMany({
    where: {
      ...(Number.isFinite(tmdbId as number) && (tmdbId as number) > 0
        ? { tmdbId: tmdbId as number }
        : {}),
      ...(mediaType === "movie" || mediaType === "tv"
        ? { mediaType }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
              { embedUrl: { contains: q, mode: "insensitive" } },
              ...(Number.isFinite(Number(q))
                ? [{ tmdbId: Number(q) }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (!isHttpsUrl(data.embedUrl)) {
    return NextResponse.json(
      { error: "El link debe ser una URL https válida." },
      { status: 400 }
    );
  }

  const season =
    data.mediaType === "tv" ? (data.season ?? null) : null;
  const episode =
    data.mediaType === "tv" ? (data.episode ?? null) : null;

  const row = await prisma.streamOverride.create({
    data: {
      mediaType: data.mediaType,
      tmdbId: data.tmdbId,
      season,
      episode,
      title: data.title?.trim() || null,
      embedUrl: data.embedUrl.trim(),
      label: (data.label || "VeoTV").trim().slice(0, 60),
      enabled: data.enabled ?? true,
      priority: data.priority ?? 10,
      notes: data.notes?.trim() || null,
    },
  });

  return NextResponse.json({ item: row }, { status: 201 });
}
