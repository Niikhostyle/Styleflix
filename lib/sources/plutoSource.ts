/**
 * Pluto TV como fuente de catálogo. Es contenido gratuito y legal que ya
 * sabemos reproducir, así que todo lo que aporta se marca como reproducible.
 * Se mapea a ids TMDB para compartir metadatos y rutas con el resto del catálogo.
 */

import { getPlutoCatalog, type PlutoMatch } from "@/lib/pluto";
import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

const MATCH_CONCURRENCY = 5;
/** Mapear a TMDB cuesta una búsqueda por título: acotamos por fila. */
const ROW_SIZE = 28;

async function toCatalogItems(
  matches: PlutoMatch[],
  mediaType: MediaType
): Promise<CatalogItem[]> {
  const mapped = await mapWithConcurrency(
    matches,
    MATCH_CONCURRENCY,
    async (entry) => {
      try {
        const match = await findTmdbMatch({
          title: entry.name,
          mediaType,
          year: entry.year,
        });
        return match ? toCatalogItem(match, "pluto", true) : null;
      } catch {
        return null;
      }
    }
  );

  return mapped.filter((item): item is CatalogItem => item !== null);
}

export async function getPlutoRows(): Promise<
  { title: string; mediaType: MediaType; items: CatalogItem[] }[]
> {
  const catalog = await getPlutoCatalog();

  const [movies, series] = await Promise.all([
    toCatalogItems(catalog.movies.slice(0, ROW_SIZE), "movie"),
    toCatalogItems(catalog.series.slice(0, ROW_SIZE), "tv"),
  ]);

  return [
    { title: "Películas destacadas", mediaType: "movie", items: movies },
    { title: "Series destacadas", mediaType: "tv", items: series },
  ];
}

/** Solo películas de Pluto TV — para la página de películas. */
export async function getPlutoMovies(): Promise<CatalogItem[]> {
  const catalog = await getPlutoCatalog();
  return toCatalogItems(catalog.movies.slice(0, ROW_SIZE), "movie");
}

/** Solo series de Pluto TV — para la página de series. */
export async function getPlutoSeries(): Promise<CatalogItem[]> {
  const catalog = await getPlutoCatalog();
  return toCatalogItems(catalog.series.slice(0, ROW_SIZE), "tv");
}
