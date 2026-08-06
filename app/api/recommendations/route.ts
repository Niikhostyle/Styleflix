import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getMediaDetails,
  getSimilarMedia,
  getTrendingMovies,
  getTrendingSeries,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

function buildUrl(path: string, query = "") {
  const key = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!key) return null;
  return `https://api.themoviedb.org/3${path}?api_key=${key}&language=es-ES${query}`;
}

async function discoverByGenres(
  type: MediaType,
  genreIds: number[]
): Promise<MediaItem[]> {
  if (!genreIds.length) return [];
  const url = buildUrl(
    `/discover/${type}`,
    `&with_genres=${genreIds.slice(0, 3).join(",")}&sort_by=popularity.desc`
  );
  if (!url) return [];
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results || []) as MediaItem[]).map((item) => ({
      ...item,
      media_type: type,
    }));
  } catch {
    return [];
  }
}

/**
 * Recomendaciones según lo más visto:
 * 1) similares TMDB de lo reciente
 * 2) discover por géneros más frecuentes en el historial
 * 3) fallback trending si no hay historial
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], reason: "because" });
  }

  const recent = await prisma.watchProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { lastWatchedAt: "desc" },
    take: 12,
  });

  const seen = new Set(recent.map((r) => `${r.mediaType}-${r.tmdbId}`));
  const merged: MediaItem[] = [];
  const used = new Set<string>();
  let becauseTitle: string | null = recent[0]?.title || null;

  const push = (item: MediaItem) => {
    const type = (item.media_type ?? "movie") as MediaType;
    const key = `${type}-${item.id}`;
    if (seen.has(key) || used.has(key)) return;
    used.add(key);
    merged.push({ ...item, media_type: type });
  };

  if (recent.length) {
    const similarPools = await Promise.all(
      recent.slice(0, 4).map((row) =>
        getSimilarMedia(row.mediaType as MediaType, row.tmdbId).catch(() => [])
      )
    );
    for (const list of similarPools) {
      for (const item of list) {
        push(item);
        if (merged.length >= 24) break;
      }
      if (merged.length >= 24) break;
    }

    // Affinity por géneros de lo más visto
    if (merged.length < 16) {
      const genreCount = new Map<number, number>();
      const typeCount = { movie: 0, tv: 0 };
      const details = await Promise.all(
        recent.slice(0, 6).map(async (row) => {
          try {
            const d = await getMediaDetails(
              row.mediaType as MediaType,
              row.tmdbId
            );
            return { type: row.mediaType as MediaType, detail: d };
          } catch {
            return null;
          }
        })
      );
      for (const row of details) {
        if (!row?.detail) continue;
        typeCount[row.type] += 1;
        const genres = row.detail.genres || [];
        for (const g of genres) {
          genreCount.set(g.id, (genreCount.get(g.id) || 0) + 1);
        }
      }
      const topGenres = [...genreCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
      const preferType: MediaType =
        typeCount.tv >= typeCount.movie ? "tv" : "movie";
      const discovered = await Promise.all([
        discoverByGenres(preferType, topGenres),
        discoverByGenres(preferType === "tv" ? "movie" : "tv", topGenres),
      ]);
      for (const list of discovered) {
        for (const item of list) {
          push(item);
          if (merged.length >= 24) break;
        }
        if (merged.length >= 24) break;
      }
    }
  }

  if (!merged.length) {
    const [movies, series] = await Promise.all([
      getTrendingMovies().catch(() => []),
      getTrendingSeries().catch(() => []),
    ]);
    for (const item of [...movies.slice(0, 10), ...series.slice(0, 10)]) {
      push(item);
    }
    becauseTitle = null;
  }

  return NextResponse.json({
    items: merged.slice(0, 20),
    because: becauseTitle
      ? `Porque viste ${becauseTitle}`
      : "Tendencias para ti",
  });
}
