/**
 * Búsqueda unificada VeoTV.
 * Animes → AnimeAV1 (/anime/[slug]).
 * Mangas ES → MangaDex (/manga/[slug]).
 * Películas/series → TMDB, excluyendo género Animation (16).
 */

import { searchAnime } from "animeav1-api";
import { getMangaEsCatalog } from "@/lib/manga-es";
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
  kind: "anime" | "manga" | "movie" | "tv";
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

async function searchMangaHits(query: string): Promise<SearchHit[]> {
  if (!isSourceEnabled("mangadex")) return [];
  try {
    const q = query.toLowerCase().trim();
    const catalog = await getMangaEsCatalog(80);
    const hits: SearchHit[] = [];
    for (const m of catalog) {
      const title = m.title.toLowerCase();
      const es = (m.titleEs || "").toLowerCase();
      if (!title.includes(q) && !es.includes(q)) continue;
      hits.push({
        key: `manga-${m.slug}`,
        kind: "manga",
        title: m.title,
        year: m.year ? String(m.year) : null,
        poster: m.poster,
        href: `/manga/${m.slug}`,
        label: "Manga",
      });
      if (hits.length >= 12) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] manga", err);
    return [];
  }
}

async function searchTmdbHits(query: string): Promise<SearchHit[]> {
  try {
    const items = await searchMulti(query);
    const hits: SearchHit[] = [];
    for (const item of items) {
      if (isTmdbAnimation(item)) continue;
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
        label: type === "tv" ? "Serie" : "Película",
      });
      if (hits.length >= 20) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] tmdb", err);
    return [];
  }
}

/** Animes + mangas primero; luego películas/series. */
export async function searchCatalog(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [anime, manga, tmdb] = await Promise.all([
    searchAnimeHits(q),
    searchMangaHits(q),
    searchTmdbHits(q),
  ]);

  return [...anime, ...manga, ...tmdb].slice(0, 40);
}
