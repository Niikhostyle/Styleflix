/**
 * Búsqueda unificada VeoTV con ranking por palabras clave.
 * Fuentes: AnimeAV1, MangaDex ES, TMDB (películas/series, incl. animación).
 * Resultados irrelevantes (p. ej. anime que no contiene los tokens) se descartan.
 */

import { searchAnime } from "animeav1-api";
import { getMangaEsCatalog } from "@/lib/manga-es";
import { prisma } from "@/lib/prisma";
import { normalizeTitle, scoreTitleMatch, yearFrom } from "@/lib/sources/match";
import { isSourceEnabled } from "@/lib/sources/types";
import {
  getDisplayTitle,
  getReleaseYear,
  searchMulti,
} from "@/lib/tmdb";

export type SearchHit = {
  key: string;
  kind: "anime" | "manga" | "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  href: string;
  label: string;
};

type ScoredHit = SearchHit & { score: number };

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "y",
  "o",
  "en",
  "vs",
]);

function absolutePoster(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://cdn.animeav1.com${url.startsWith("/") ? url : `/${url}`}`;
}

/** Tokens útiles: palabras >2 chars o números (secuelas / años). */
function queryTokens(queryNorm: string): string[] {
  return queryNorm
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .filter((t) => /^\d+$/.test(t) || (t.length > 2 && !STOPWORDS.has(t)));
}

function extractQueryYear(query: string): number | null {
  const m = query.match(/\b((?:19|20)\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Puntuación de búsqueda por palabras clave.
 * Premia coincidencias fuertes; no descarta títulos débiles (TMDB ya filtra).
 * Devuelve -1 solo si no hay ningún token en común (ruido total).
 */
function scoreSearchTitle(
  title: string,
  queryNorm: string,
  tokens: string[],
  opts?: { year?: number | null; strict?: boolean }
): number {
  const base = scoreTitleMatch(title, queryNorm, {
    candidateYear: opts?.year ?? null,
    queryYear: extractQueryYear(queryNorm) ?? null,
  });

  const cand = normalizeTitle(title);
  if (!cand || !tokens.length) return base;

  const hits = tokens.filter((t) => cand.includes(t));
  const miss = tokens.length - hits.length;

  if (hits.length === 0) return -1;

  // Solo fuentes ruidosas (anime): exigir al menos la mitad de tokens
  if (
    opts?.strict &&
    tokens.length >= 2 &&
    hits.length < Math.ceil(tokens.length * 0.5)
  ) {
    return -1;
  }

  let score = base >= 0 ? base : hits.length * 12;
  score += hits.length * 10;
  if (hits.length === tokens.length) score += 30;
  score -= miss * 8;

  const prefix = tokens.slice(0, Math.min(2, tokens.length)).join(" ");
  if (prefix && cand.startsWith(prefix)) score += 20;

  return score;
}

async function searchAnimeHits(
  query: string,
  queryNorm: string,
  tokens: string[]
): Promise<ScoredHit[]> {
  if (!isSourceEnabled("animeav1")) return [];
  try {
    const results = await searchAnime(query);
    const hits: ScoredHit[] = [];
    const seen = new Set<string>();
    for (const item of results || []) {
      const slug = (item.slug || "").trim();
      const title = (item.title || "").trim();
      if (!slug || !title || seen.has(slug)) continue;
      const score = scoreSearchTitle(title, queryNorm, tokens, { strict: true });
      if (score < 0) continue;
      seen.add(slug);
      hits.push({
        key: `anime-${slug}`,
        kind: "anime",
        title,
        year: null,
        poster: absolutePoster(item.poster),
        href: `/anime/${slug}`,
        label: "Anime",
        score,
      });
      if (hits.length >= 24) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] animeav1", err);
    return [];
  }
}

async function searchMangaHits(
  queryNorm: string,
  tokens: string[]
): Promise<ScoredHit[]> {
  if (!isSourceEnabled("mangadex")) return [];
  try {
    const catalog = await getMangaEsCatalog(120);
    const hits: ScoredHit[] = [];
    for (const m of catalog) {
      const scoreMain = scoreSearchTitle(m.title, queryNorm, tokens, {
        year: m.year ?? null,
        strict: true,
      });
      const scoreEs = m.titleEs
        ? scoreSearchTitle(m.titleEs, queryNorm, tokens, {
            year: m.year ?? null,
            strict: true,
          })
        : -1;
      const score = Math.max(scoreMain, scoreEs);
      if (score < 0) continue;
      hits.push({
        key: `manga-${m.slug}`,
        kind: "manga",
        title: m.titleEs || m.title,
        year: m.year ? String(m.year) : null,
        poster: m.poster,
        href: `/manga/${m.slug}`,
        label: "Manga",
        score,
      });
      if (hits.length >= 24) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] manga", err);
    return [];
  }
}

async function searchTmdbHits(
  query: string,
  queryNorm: string,
  tokens: string[],
  overrideKeys: Set<string>
): Promise<ScoredHit[]> {
  try {
    const items = await searchMulti(query);
    const hits: ScoredHit[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      // Personajes / colecciones de search/multi no aplican
      if (item.media_type && item.media_type !== "movie" && item.media_type !== "tv") {
        continue;
      }
      const type = item.media_type === "tv" ? "tv" : "movie";
      const title = getDisplayTitle(item);
      if (!title) continue;
      const key = `${type}-${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const year = getReleaseYear(item);
      // TMDB ya rankea por relevancia: no descartar, solo ordenar por keywords
      let score = scoreSearchTitle(title, queryNorm, tokens, { year });
      if (score < 0) score = Math.max(4, 18 - hits.length);
      else score += Math.max(0, 16 - hits.length);

      if (overrideKeys.has(key)) {
        score += 35;
      }

      hits.push({
        key,
        kind: type,
        title,
        year: year ? String(year) : null,
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
          : null,
        href: `/titulo/${type}/${item.id}`,
        label:
          overrideKeys.has(key)
            ? type === "tv"
              ? "Serie · VeoTV"
              : "Película · VeoTV"
            : type === "tv"
              ? "Serie"
              : "Película",
        score,
      });
      if (hits.length >= 40) break;
    }
    return hits;
  } catch (err) {
    console.error("[search] tmdb", err);
    return [];
  }
}

/** Títulos con StreamOverride cuyo nombre coincide (catálogo propio Drive). */
async function searchOverrideHits(
  queryNorm: string,
  tokens: string[],
  already: Set<string>
): Promise<ScoredHit[]> {
  try {
    const rows = await prisma.streamOverride.findMany({
      where: { enabled: true, title: { not: null } },
      select: {
        mediaType: true,
        tmdbId: true,
        title: true,
      },
      take: 400,
      orderBy: { priority: "desc" },
    });

    const bestByKey = new Map<string, ScoredHit>();
    for (const row of rows) {
      const title = (row.title || "").trim();
      if (!title) continue;
      const type = row.mediaType === "tv" ? "tv" : "movie";
      const key = `${type}-${row.tmdbId}`;
      if (already.has(key)) continue;
      const score = scoreSearchTitle(title, queryNorm, tokens, {
        year: yearFrom(title),
      });
      if (score < 0) continue;
      const prev = bestByKey.get(key);
      if (prev && prev.score >= score + 35) continue;
      bestByKey.set(key, {
        key,
        kind: type,
        title,
        year: null,
        poster: null,
        href: `/titulo/${type}/${row.tmdbId}`,
        label: type === "tv" ? "Serie · VeoTV" : "Película · VeoTV",
        score: score + 35,
      });
    }
    return Array.from(bestByKey.values());
  } catch (err) {
    console.error("[search] overrides", err);
    return [];
  }
}

async function loadOverrideKeys(): Promise<Set<string>> {
  try {
    const rows = await prisma.streamOverride.findMany({
      where: { enabled: true },
      select: { mediaType: true, tmdbId: true },
      distinct: ["mediaType", "tmdbId"],
    });
    return new Set(
      rows.map((r) => `${r.mediaType === "tv" ? "tv" : "movie"}-${r.tmdbId}`)
    );
  } catch {
    return new Set();
  }
}

/** Ranking por relevancia de palabras clave (TMDB, anime, manga, Drive). */
export async function searchCatalog(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const queryNorm = normalizeTitle(q);
  const tokens = queryTokens(queryNorm);
  if (!tokens.length) return [];

  const overrideKeys = await loadOverrideKeys();

  const [anime, manga, tmdb] = await Promise.all([
    searchAnimeHits(q, queryNorm, tokens),
    searchMangaHits(queryNorm, tokens),
    searchTmdbHits(q, queryNorm, tokens, overrideKeys),
  ]);

  const already = new Set([...anime, ...manga, ...tmdb].map((h) => h.key));
  const overrides = await searchOverrideHits(queryNorm, tokens, already);

  const merged = [...tmdb, ...overrides, ...anime, ...manga];
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title, "es");
  });

  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of merged) {
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    const { score: _score, ...rest } = hit;
    out.push(rest);
    if (out.length >= 60) break;
  }
  return out;
}
