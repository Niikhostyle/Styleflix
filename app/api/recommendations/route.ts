import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getMediaDetails,
  getPopularMovies,
  getPopularSeries,
  getRecommendedMedia,
  getSimilarMedia,
  getTrendingMovies,
  getTrendingSeries,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

function buildUrl(path: string, query = "") {
  const key = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!key) return null;
  return `https://api.themoviedb.org/3${path}?api_key=${key}&language=es-MX${query}`;
}

async function discoverByGenres(
  type: MediaType,
  genreIds: number[],
  sort = "popularity.desc"
): Promise<MediaItem[]> {
  if (!genreIds.length) return [];
  const url = buildUrl(
    `/discover/${type}`,
    `&with_genres=${genreIds.slice(0, 3).join(",")}&sort_by=${sort}`
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

type Seed = {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  weight: number;
};

function seedWeight(row: {
  progressPct: number;
  completed: boolean;
  lastWatchedAt: Date;
}): number {
  const ageDays =
    (Date.now() - new Date(row.lastWatchedAt).getTime()) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0.35, 1 - ageDays / 45);
  const depth = Math.min(1, Math.max(0.15, row.progressPct / 100));
  const done = row.completed ? 1.45 : 1;
  return depth * done * recency;
}

function becauseLabel(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return "Recomendado para ti";
  if (clean.length === 1) return `Porque viste ${clean[0]}`;
  if (clean.length === 2) return `Porque viste ${clean[0]} y ${clean[1]}`;
  return `Porque viste ${clean[0]}, ${clean[1]} y más`;
}

/**
 * Recomendaciones según películas/series que la persona vio:
 * 1) recomendaciones + similares TMDB de los títulos con más peso
 * 2) discover por géneros del historial (populares)
 * 3) relleno con populares / tendencias
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], reason: "because" });
  }

  const recent = await prisma.watchProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { lastWatchedAt: "desc" },
    take: 24,
  });

  const seeds: Seed[] = recent
    .map((row) => ({
      mediaType: (row.mediaType === "tv" ? "tv" : "movie") as MediaType,
      tmdbId: row.tmdbId,
      title: row.title,
      weight: seedWeight(row),
    }))
    .sort((a, b) => b.weight - a.weight);

  const seen = new Set(seeds.map((s) => `${s.mediaType}-${s.tmdbId}`));
  const scored = new Map<string, { item: MediaItem; score: number }>();

  const push = (item: MediaItem, bonus: number) => {
    const type = (item.media_type ?? "movie") as MediaType;
    const key = `${type}-${item.id}`;
    if (seen.has(key)) return;
    const popularity = item.vote_average ?? 0;
    const next = bonus + popularity * 0.35;
    const prev = scored.get(key);
    if (!prev || next > prev.score) {
      scored.set(key, { item: { ...item, media_type: type }, score: next });
    }
  };

  let becauseTitles: string[] = [];

  if (seeds.length) {
    becauseTitles = seeds.slice(0, 3).map((s) => s.title);

    const topSeeds = seeds.slice(0, 8);
    const pools = await Promise.all(
      topSeeds.map(async (seed) => {
        const [recommended, similar] = await Promise.all([
          getRecommendedMedia(seed.mediaType, seed.tmdbId).catch(() => []),
          getSimilarMedia(seed.mediaType, seed.tmdbId).catch(() => []),
        ]);
        return { seed, recommended, similar };
      })
    );

    for (const { seed, recommended, similar } of pools) {
      recommended.slice(0, 10).forEach((item, i) => {
        push(item, seed.weight * 40 + (10 - i) * 2);
      });
      similar.slice(0, 8).forEach((item, i) => {
        push(item, seed.weight * 28 + (8 - i));
      });
    }

    const genreCount = new Map<number, number>();
    const typeWeight = { movie: 0, tv: 0 };
    const details = await Promise.all(
      topSeeds.slice(0, 8).map(async (seed) => {
        try {
          const d = await getMediaDetails(seed.mediaType, seed.tmdbId);
          return { seed, detail: d };
        } catch {
          return null;
        }
      })
    );

    for (const row of details) {
      if (!row?.detail) continue;
      typeWeight[row.seed.mediaType] += row.seed.weight;
      for (const g of row.detail.genres || []) {
        genreCount.set(
          g.id,
          (genreCount.get(g.id) || 0) + row.seed.weight
        );
      }
    }

    const topGenres = [...genreCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    if (topGenres.length) {
      const preferType: MediaType =
        typeWeight.tv >= typeWeight.movie ? "tv" : "movie";
      const other: MediaType = preferType === "tv" ? "movie" : "tv";
      const discovered = await Promise.all([
        discoverByGenres(preferType, topGenres, "popularity.desc"),
        discoverByGenres(other, topGenres, "popularity.desc"),
        discoverByGenres(preferType, topGenres, "vote_average.desc"),
      ]);
      for (const list of discovered) {
        list.slice(0, 12).forEach((item, i) => {
          push(item, 12 + (12 - i));
        });
      }
    }
  }

  // Relleno: populares y tendencias (estrenos / más vistas del mundo TMDB)
  if (scored.size < 20) {
    const [popM, popS, trendM, trendS] = await Promise.all([
      getPopularMovies().catch(() => []),
      getPopularSeries().catch(() => []),
      getTrendingMovies().catch(() => []),
      getTrendingSeries().catch(() => []),
    ]);
    [...trendM.slice(0, 8), ...trendS.slice(0, 8)].forEach((item, i) =>
      push(item, 8 - i * 0.2)
    );
    [...popM.slice(0, 8), ...popS.slice(0, 8)].forEach((item, i) =>
      push(item, 6 - i * 0.15)
    );
  }

  const items = [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
    .slice(0, 24);

  return NextResponse.json({
    items,
    because: seeds.length
      ? becauseLabel(becauseTitles)
      : "Populares y tendencias para ti",
  });
}
