/**
 * AnimeAV1 como fuente de catálogo de animes.
 * Se mapea a ids TMDB para rutas /titulo/tv|movie/{id}.
 */

import { fetchAnimeAv1CatalogPages } from "@/lib/animeav1";
import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency, yearFrom } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

const MATCH_CONCURRENCY = 4;
const PAGE_SIZE_CAP = 40;

function av1MediaType(typeSlug?: string | null, type?: string | null): MediaType {
  const s = `${typeSlug || ""} ${type || ""}`.toLowerCase();
  if (s.includes("pelicula") || s.includes("movie") || s.includes("film")) {
    return "movie";
  }
  return "tv";
}

async function toCatalogItems(
  entries: Awaited<ReturnType<typeof fetchAnimeAv1CatalogPages>>
): Promise<CatalogItem[]> {
  const mapped = await mapWithConcurrency(
    entries.slice(0, PAGE_SIZE_CAP),
    MATCH_CONCURRENCY,
    async (entry) => {
      const title = (entry.title || "").trim();
      if (!title) return null;
      const mediaType = av1MediaType(entry.typeSlug, entry.type);
      try {
        const match = await findTmdbMatch({
          title,
          mediaType,
          year: yearFrom(null),
        });
        if (!match) return null;
        return toCatalogItem(match, "animeav1", true);
      } catch {
        return null;
      }
    }
  );
  return mapped.filter((x): x is CatalogItem => x !== null);
}

/** Filas listas para el catálogo de animes / home. */
export async function getAnimeAv1Rows(): Promise<
  { title: string; mediaType: MediaType; items: CatalogItem[] }[]
> {
  const [popular, latest, movies] = await Promise.all([
    fetchAnimeAv1CatalogPages({ pages: 2, order: "popular" }),
    fetchAnimeAv1CatalogPages({ pages: 2, order: "latest_added" }),
    fetchAnimeAv1CatalogPages({
      pages: 1,
      order: "popular",
      category: "pelicula",
    }),
  ]);

  const [popItems, latestItems, movieItems] = await Promise.all([
    toCatalogItems(popular),
    toCatalogItems(latest),
    toCatalogItems(movies),
  ]);

  return [
    { title: "Animes populares", mediaType: "tv", items: popItems },
    { title: "Recién añadidos", mediaType: "tv", items: latestItems },
    ...(movieItems.length
      ? [{ title: "Películas de anime", mediaType: "movie" as const, items: movieItems }]
      : []),
  ];
}

/** Lista plana (para disponibilidad / home). */
export async function getAnimeAv1Items(): Promise<CatalogItem[]> {
  const rows = await getAnimeAv1Rows();
  const byId = new Map<number, CatalogItem>();
  for (const row of rows) {
    for (const item of row.items) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}
