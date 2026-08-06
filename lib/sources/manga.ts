/**
 * Fuente de mangas en español (MangaDex / caché scrape-mangas-es).
 */

import { getMangaEsCatalog } from "@/lib/manga-es";
import type { CatalogItem, CatalogRow } from "@/lib/sources/types";

/** Offset de ids para no chocar con TMDB / AnimeAV1. */
const ID_BASE = 900_000_000;

function hashId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (h * 31 + uuid.charCodeAt(i)) >>> 0;
  }
  return ID_BASE + (h % 50_000_000);
}

export async function getMangaEsItems(limit = 36): Promise<CatalogItem[]> {
  const entries = await getMangaEsCatalog(limit);
  return entries.map((m) => ({
    id: hashId(m.id),
    title: m.title,
    name: m.title,
    overview: m.synopsis || "",
    poster_path: m.poster,
    backdrop_path: m.poster,
    media_type: "tv" as const,
    sources: ["mangadex" as const],
    playable: true,
    mangaSlug: m.slug,
    mangaDexId: m.id,
  }));
}

export async function getMangaEsRows(): Promise<CatalogRow[]> {
  const items = await getMangaEsItems(48);
  if (!items.length) return [];

  const half = Math.ceil(items.length / 2);
  return [
    {
      title: "Mangas populares en español",
      mediaType: "tv",
      items: items.slice(0, half),
    },
    {
      title: "Más mangas para leer",
      mediaType: "tv",
      items: items.slice(half),
    },
  ].filter((r) => r.items.length > 0);
}
