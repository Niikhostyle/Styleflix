import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const upsertSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  title: z.string().min(1).max(300),
  posterPath: z.string().nullable().optional(),
  season: z.number().int().positive().nullable().optional(),
  episode: z.number().int().positive().nullable().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  positionSeconds: z.number().min(0).nullable().optional(),
  completed: z.boolean().optional(),
});

/** Lista "Continuar viendo" / historial del usuario autenticado */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], history: [] });
  }

  const wantHistory =
    new URL(request.url).searchParams.get("history") === "1";

  const continueRows = await prisma.watchProgress.findMany({
    where: {
      userId: session.user.id,
      completed: false,
    },
    orderBy: { lastWatchedAt: "desc" },
    take: 24,
  });

  const toItem = (
    row: (typeof continueRows)[number],
    opts?: { forceCompleted?: boolean }
  ) => ({
    id: row.tmdbId,
    title: row.mediaType === "movie" ? row.title : undefined,
    name: row.mediaType === "tv" ? row.title : undefined,
    poster_path: row.posterPath,
    media_type: row.mediaType as "movie" | "tv",
    overview: "",
    season: row.season,
    episode: row.episode,
    progressPct: row.progressPct,
    positionSeconds: row.positionSeconds ?? null,
    completed: opts?.forceCompleted ?? row.completed,
    lastWatchedAt: row.lastWatchedAt.toISOString(),
  });

  const items = continueRows.map((row) => toItem(row));

  if (!wantHistory) {
    return NextResponse.json({ items });
  }

  const historyRows = await prisma.watchProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { lastWatchedAt: "desc" },
    take: 36,
  });

  return NextResponse.json({
    items,
    history: historyRows.map((row) => toItem(row)),
  });
}

/** Guarda o actualiza progreso (solo registrados) */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
  }

  try {
    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const data = parsed.data;
    const row = await prisma.watchProgress.upsert({
      where: {
        userId_mediaType_tmdbId: {
          userId: session.user.id,
          mediaType: data.mediaType,
          tmdbId: data.tmdbId,
        },
      },
      create: {
        userId: session.user.id,
        mediaType: data.mediaType,
        tmdbId: data.tmdbId,
        title: data.title,
        posterPath: data.posterPath ?? null,
        season: data.season ?? (data.mediaType === "tv" ? 1 : null),
        episode: data.episode ?? (data.mediaType === "tv" ? 1 : null),
        progressPct: data.progressPct ?? 5,
        positionSeconds:
          data.completed
            ? 0
            : data.positionSeconds != null
              ? data.positionSeconds
              : null,
        completed: data.completed ?? false,
        lastWatchedAt: new Date(),
      },
      update: {
        title: data.title,
        posterPath: data.posterPath ?? undefined,
        season: data.season ?? undefined,
        episode: data.episode ?? undefined,
        progressPct: data.progressPct ?? undefined,
        positionSeconds: data.completed
          ? 0
          : data.positionSeconds !== undefined
            ? data.positionSeconds
            : undefined,
        completed: data.completed ?? undefined,
        lastWatchedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, progress: row });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar el progreso" },
      { status: 500 }
    );
  }
}

/** Obtener progreso de un título concreto */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ progress: null });
  }

  try {
    const body = await request.json();
    const mediaType = body.mediaType as string;
    const tmdbId = Number(body.tmdbId);
    if (!mediaType || !tmdbId) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const progress = await prisma.watchProgress.findUnique({
      where: {
        userId_mediaType_tmdbId: {
          userId: session.user.id,
          mediaType,
          tmdbId,
        },
      },
    });

    return NextResponse.json({ progress });
  } catch {
    return NextResponse.json({ progress: null });
  }
}
