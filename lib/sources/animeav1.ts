/**
 * AnimeAV1 como fuente principal de animes.
 * Incluye el catálogo scrapado de animeav1.com; TMDB solo enriquece cuando hay match.
 */

import { fetchAnimeAv1CatalogPages } from "@/lib/animeav1";
import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency, yearFrom } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";
import type { CatalogItem as Av1CatalogItem } from "animeav1-api";

const MATCH_CONCURRENCY = 4;
const PAGE_SIZE_CAP = 60;

function av1MediaType(typeSlug?: string | null, type?: string | null): MediaType {
  const s = `${typeSlug || ""} ${type || ""}`.toLowerCase();
  if (s.includes("pelicula") || s.includes("movie") || s.includes("film")) {
    return "movie";
  }
  return "tv";
}

function absolutePoster(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://cdn.animeav1.com${url.startsWith("/") ? url : `/${url}`}`;
}

function fromAv1Only(entry: Av1CatalogItem): CatalogItem {
  const mediaType = av1MediaType(entry.typeSlug, entry.type);
  const poster = absolutePoster(entry.poster);
  // Offset para no chocar con ids TMDB en el merge del home
  const id = 800_000_000 + entry.id;
  return {
    id,
    title: entry.title,
    name: entry.title,
    overview: entry.synopsis || "",
    poster_path: poster,
    backdrop_path: poster,
    media_type: mediaType,
    sources: ["animeav1"],
    playable: true,
    animeAv1Slug: entry.slug,
  };
}

async function toCatalogItems(
  entries: Av1CatalogItem[]
): Promise<CatalogItem[]> {
  const mapped = await mapWithConcurrency(
    entries.slice(0, PAGE_SIZE_CAP),
    MATCH_CONCURRENCY,
    async (entry) => {
      const title = (entry.title || "").trim();
      if (!title || !entry.slug) return null;
      const mediaType = av1MediaType(entry.typeSlug, entry.type);
      const base = fromAv1Only(entry);

      try {
        const match = await findTmdbMatch({
          title,
          mediaType,
          year: yearFrom(null),
        });
        if (match) {
          return {
            ...toCatalogItem(match, "animeav1", true),
            animeAv1Slug: entry.slug,
            // Preferir póster de AnimeAV1 si TMDB no trae
            poster_path: match.poster_path || base.poster_path,
            backdrop_path: match.backdrop_path || base.backdrop_path,
            overview: match.overview || base.overview,
          };
        }
      } catch {
        /* fallback AV1 puro */
      }
      return base;
    }
  );
  return mapped.filter((x): x is CatalogItem => x !== null);
}

/** Filas listas para el catálogo de animes / home. */
export async function getAnimeAv1Rows(): Promise<
  { title: string; mediaType: MediaType; items: CatalogItem[] }[]
> {
  const [popular, latest, movies, airing] = await Promise.all([
    fetchAnimeAv1CatalogPages({ pages: 4, order: "popular" }),
    fetchAnimeAv1CatalogPages({ pages: 3, order: "latest_added" }),
    fetchAnimeAv1CatalogPages({
      pages: 2,
      order: "popular",
      category: "pelicula",
    }),
    fetchAnimeAv1CatalogPages({
      pages: 2,
      order: "latest_released",
      category: "tv-anime",
    }),
  ]);

  const [popItems, latestItems, movieItems, airingItems] = await Promise.all([
    toCatalogItems(popular),
    toCatalogItems(latest),
    toCatalogItems(movies),
    toCatalogItems(airing),
  ]);

  return [
    { title: "Animes populares", mediaType: "tv", items: popItems },
    { title: "Recién añadidos", mediaType: "tv", items: latestItems },
    { title: "Últimos episodios", mediaType: "tv", items: airingItems },
    ...(movieItems.length
      ? [
          {
            title: "Películas de anime",
            mediaType: "movie" as const,
            items: movieItems,
          },
        ]
      : []),
  ];
}

/** Lista plana (para disponibilidad / home). */
export async function getAnimeAv1Items(): Promise<CatalogItem[]> {
  const rows = await getAnimeAv1Rows();
  const byKey = new Map<string, CatalogItem>();
  for (const row of rows) {
    for (const item of row.items) {
      const key = item.animeAv1Slug || `${item.media_type}-${item.id}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/**
 * Home: 1 página popular, sin match TMDB (barato).
 * Evita 11 fetches + N búsquedas TMDB en cada SSR.
 */
export async function getAnimeAv1HomeItems(limit = 24): Promise<CatalogItem[]> {
  const popular = await fetchAnimeAv1CatalogPages({
    pages: 1,
    order: "popular",
  });
  return popular.slice(0, limit).map(fromAv1Only);
}
