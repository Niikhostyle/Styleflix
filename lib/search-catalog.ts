/**
 * Búsqueda unificada VeoTV.
 * Animes → siempre AnimeAV1 (/anime/[slug]).
 * Películas/series → TMDB, excluyendo género Animation (16).
 */

import { searchAnime } from "animeav1-api";
import { isSourceEnabled } from "@/lib/sources/types";
import {
  getDisplayTitle,
  getReleaseYear,
  searchMulti,
  type MediaItem,
} from "@/lib/tmdb";

const TMDB_ANIMATION_GENRE = 16;

export type SearchHit = {
  key: string;
  kind: "anime" | "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  href: string;
  label: string;
};

function absolutePoster(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://cdn.animeav1.com${url.startsWith("/") ? url : `/${url}`}`;
}

function isTmdbAnimation(item: MediaItem): boolean {
  return Boolean(item.genre_ids?.includes(TMDB_ANIMATION_GENRE));
}

async function searchAnimeHits(query: string): Promise<SearchHit[]> {
  if (!isSourceEnabled("animeav1")) return [];
  try {
    const results = await searchAnime(query);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    for (const item of results || []) {
      const slug = (item.slug || "").trim();
      const title = (item.title || "").trim();
      if (!slug || !title || seen.has(slug)) continue;
      seen.add(slug);
      hits.push({
        key: `anime-${slug}`,
        kind: "anime",
        title,
        year: null,
        poster: absolutePoster(item.poster),
        href: `/anime/${slug}`,
        label: "Anime",
      });
      if (hits.length >= 20) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] animeav1", err);
    return [];
  }
}

async function searchTmdbHits(query: string): Promise<SearchHit[]> {
  try {
    const items = await searchMulti(query);
    const hits: SearchHit[] = [];
    for (const item of items) {
      if (isTmdbAnimation(item)) continue; // animes solo vía módulo AnimeAV1
      const type = item.media_type === "tv" ? "tv" : "movie";
      const title = getDisplayTitle(item);
      if (!title) continue;
      const year = getReleaseYear(item);
      hits.push({
        key: `${type}-${item.id}`,
        kind: type,
        title,
        year: year ? String(year) : null,
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
          : null,
        href: `/titulo/${type}/${item.id}`,
        label: type === "movie" ? "Película" : "Serie",
      });
      if (hits.length >= 24) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] tmdb", err);
    return [];
  }
}

/** Animes primero; luego películas/series no-animación. */
export async function searchCatalog(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [anime, tmdb] = await Promise.all([
    searchAnimeHits(q),
    searchTmdbHits(q),
  ]);

  return [...anime, ...tmdb].slice(0, 36);
}
