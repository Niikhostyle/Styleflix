/**
 * Jikan — API pública no oficial de MyAnimeList (sin API key).
 * Aporta el catálogo de anime que TMDB describe peor: temporada en emisión,
 * rankings y clásicos. Cada anime se mapea a su id de TMDB para que las rutas
 * y el reproductor sigan funcionando igual que el resto del catálogo.
 *
 * Límites de Jikan: ~3 req/s y 60 req/min, por eso limitamos concurrencia.
 */

import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency, yearFrom } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

const BASE = "https://api.jikan.moe/v4";
const MATCH_CONCURRENCY = 4;

type JikanAnime = {
  mal_id?: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  type?: string | null;
  year?: number | null;
  aired?: { from?: string | null } | null;
  score?: number | null;
  synopsis?: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Jikan responde 429 al pasarse de ritmo y 504 de forma intermitente cuando su
 * caché está fría, así que reintentamos con espera creciente.
 */
async function jikanFetch(path: string): Promise<JikanAnime[]> {
  const attempts = 3;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      // El catálogo de anime cambia por temporada: un día de caché es suficiente
      // y mantiene el consumo muy por debajo del límite de Jikan.
      next: { revalidate: 86400, tags: ["jikan"] },
    });

    if (res.ok) {
      const payload = (await res.json()) as { data?: JikanAnime[] };
      return Array.isArray(payload.data) ? payload.data : [];
    }

    lastStatus = res.status;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === attempts) break;

    await sleep(attempt * 1200);
  }

  throw new Error(`Jikan ${path} → ${lastStatus}`);
}

function jikanMediaType(anime: JikanAnime): MediaType {
  return (anime.type || "").toLowerCase() === "movie" ? "movie" : "tv";
}

/** Convierte entradas de MyAnimeList en ítems de catálogo con id TMDB. */
async function toCatalogItems(animes: JikanAnime[]): Promise<CatalogItem[]> {
  const mapped = await mapWithConcurrency(
    animes,
    MATCH_CONCURRENCY,
    async (anime) => {
      const primary = (anime.title_english || anime.title || "").trim();
      if (!primary) return null;

      const mediaType = jikanMediaType(anime);
      const year = anime.year ?? yearFrom(anime.aired?.from ?? null);

      try {
        const match = await findTmdbMatch({
          title: primary,
          altTitle: anime.title && anime.title !== primary ? anime.title : null,
          mediaType,
          year,
        });
        if (!match) return null;

        return toCatalogItem(
          {
            ...match,
            overview: match.overview || anime.synopsis || "",
            vote_average: match.vote_average ?? anime.score ?? undefined,
          },
          "jikan",
          false
        );
      } catch {
        return null;
      }
    }
  );

  return mapped.filter((item): item is CatalogItem => item !== null);
}

async function fetchOrEmpty(path: string): Promise<JikanAnime[]> {
  try {
    return await jikanFetch(path);
  } catch (err) {
    console.error(`[jikan] ${path} no disponible`, err);
    return [];
  }
}

type JikanRow = { title: string; mediaType: MediaType; items: CatalogItem[] };

async function buildRow(
  title: string,
  animes: JikanAnime[],
  mediaType: MediaType
): Promise<JikanRow> {
  const filtered = animes.filter((a) => jikanMediaType(a) === mediaType);
  return { title, mediaType, items: await toCatalogItems(filtered) };
}

/**
 * Filas de anime desde MyAnimeList.
 *
 * Solo usamos `/top/anime` paginado y `/seasons/*`: los parámetros `type` y
 * `filter` hacen que Jikan responda 504 de forma consistente, así que la
 * separación entre series y películas se hace aquí y no en la consulta.
 * Las peticiones van en serie para no chocar con el límite de ~3 req/s.
 */
export async function getJikanAnimeRows(): Promise<JikanRow[]> {
  const seasonNow = await fetchOrEmpty("/seasons/now");
  await sleep(400);
  const topPage1 = await fetchOrEmpty("/top/anime");
  await sleep(400);
  const topPage2 = await fetchOrEmpty("/top/anime?page=2");

  const top = [...topPage1, ...topPage2];

  const rows = await Promise.all([
    buildRow("Anime en emisión ahora", seasonNow, "tv"),
    buildRow("Top anime de MyAnimeList", topPage1, "tv"),
    buildRow("Más joyas de MyAnimeList", topPage2, "tv"),
    buildRow("Películas de anime imprescindibles", top, "movie"),
  ]);

  return rows.filter((row) => row.items.length > 0);
}
