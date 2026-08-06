/**
 * Jikan — API pública no oficial de MyAnimeList (sin API key).
 * Opcional: con AnimeAV1 como fuente principal de anime, Jikan queda
 * desactivado por defecto (ver enabledSources). Actívalo con
 * CATALOG_SOURCES=...,jikan si lo necesitas.
 *
 * Límites de Jikan: ~3 req/s y 60 req/min; suele responder 504/timeout.
 */

import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency, yearFrom } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

const BASE = "https://api.jikan.moe/v4";
const MATCH_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 8000;

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

async function jikanFetch(path: string): Promise<JikanAnime[]> {
  const attempts = 2;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json" },
        // No usar Data Cache de Next: evita reintentos ruidosos en build/SSR.
        cache: "no-store",
        signal: ctrl.signal,
      });

      if (res.ok) {
        const payload = (await res.json()) as { data?: JikanAnime[] };
        return Array.isArray(payload.data) ? payload.data : [];
      }

      lastStatus = res.status;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === attempts) break;
      await sleep(attempt * 800);
    } catch (err) {
      if (attempt === attempts) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      await sleep(attempt * 800);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Jikan ${path} → ${lastStatus || "timeout"}`);
}

function jikanMediaType(anime: JikanAnime): MediaType {
  return (anime.type || "").toLowerCase() === "movie" ? "movie" : "tv";
}

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
    const msg = err instanceof Error ? err.message : String(err);
    // Un solo warn corto: no spamear stack traces en producción.
    console.warn(`[jikan] omitido ${path}: ${msg.slice(0, 120)}`);
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

export async function getJikanAnimeRows(): Promise<JikanRow[]> {
  const seasonNow = await fetchOrEmpty("/seasons/now");
  await sleep(400);
  const topPage1 = await fetchOrEmpty("/top/anime");

  const rows = await Promise.all([
    buildRow("Anime en emisión ahora", seasonNow, "tv"),
    buildRow("Top anime de MyAnimeList", topPage1, "tv"),
    buildRow("Películas de anime imprescindibles", topPage1, "movie"),
  ]);

  return rows.filter((row) => row.items.length > 0);
}
