import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }

  const rows = await prisma.mangaReadProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { lastReadAt: "desc" },
    take: 24,
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      mangaId: r.mangaId,
      mangaSlug: r.mangaSlug,
      title: r.title,
      poster: r.poster,
      chapterId: r.chapterId,
      chapterNum: r.chapterNum,
      pageIndex: r.pageIndex,
      progressPct: r.progressPct,
      lastReadAt: r.lastReadAt.toISOString(),
    })),
  });
}

const upsertSchema = z.object({
  mangaId: z.string().min(8).max(64),
  mangaSlug: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  poster: z.string().nullable().optional(),
  chapterId: z.string().min(8).max(64),
  chapterNum: z.string().min(1).max(32),
  pageIndex: z.number().int().min(0).optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, skipped: true });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const d = parsed.data;
  const row = await prisma.mangaReadProgress.upsert({
    where: {
      userId_mangaId: {
        userId: session.user.id,
        mangaId: d.mangaId,
      },
    },
    create: {
      userId: session.user.id,
      mangaId: d.mangaId,
      mangaSlug: d.mangaSlug,
      title: d.title.slice(0, 300),
      poster: d.poster ?? null,
      chapterId: d.chapterId,
      chapterNum: d.chapterNum,
      pageIndex: d.pageIndex ?? 0,
      progressPct: d.progressPct ?? 5,
      lastReadAt: new Date(),
    },
    update: {
      mangaSlug: d.mangaSlug,
      title: d.title.slice(0, 300),
      poster: d.poster ?? undefined,
      chapterId: d.chapterId,
      chapterNum: d.chapterNum,
      pageIndex: d.pageIndex ?? undefined,
      progressPct: d.progressPct ?? undefined,
      lastReadAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, progress: row });
}
