import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getSimilarMedia,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

/**
 * Recomendaciones según lo último visto (similares TMDB).
 * Solo tiene sentido para usuarios autenticados con historial.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }

  const recent = await prisma.watchProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { lastWatchedAt: "desc" },
    take: 5,
  });

  if (!recent.length) {
    return NextResponse.json({ items: [] });
  }

  const seen = new Set(recent.map((r) => `${r.mediaType}-${r.tmdbId}`));
  const pools = await Promise.all(
    recent.slice(0, 3).map((row) =>
      getSimilarMedia(row.mediaType as MediaType, row.tmdbId).catch(() => [])
    )
  );

  const merged: MediaItem[] = [];
  const used = new Set<string>();

  for (const list of pools) {
    for (const item of list) {
      const type = (item.media_type ?? "movie") as MediaType;
      const key = `${type}-${item.id}`;
      if (seen.has(key) || used.has(key)) continue;
      used.add(key);
      merged.push({ ...item, media_type: type });
      if (merged.length >= 20) break;
    }
    if (merged.length >= 20) break;
  }

  return NextResponse.json({ items: merged });
}
