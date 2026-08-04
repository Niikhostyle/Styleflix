/**
 * Pluto TV (LATAM / Chile) — segunda fuente si Vimeus no tiene el título.
 * Usa el catálogo VOD público y abre la página on-demand en iframe.
 * Docs internas: https://api.pluto.tv/v3/vod/categories
 */

export type PlutoMatch = {
  id: string;
  slug: string;
  name: string;
  type: "movie" | "series";
  year: number | null;
  watchUrl: string;
};

type PlutoRawItem = {
  _id?: string;
  slug?: string;
  name?: string;
  type?: string;
};

const PLUTO_API = "https://api.pluto.tv/v3/vod/categories";
const WATCH_BASE = "https://pluto.tv/latam/on-demand";

let catalogCache: {
  at: number;
  movies: PlutoMatch[];
  series: PlutoMatch[];
} | null = null;

const CACHE_MS = 60 * 60 * 1000;

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function yearFromSlug(slug: string): number | null {
  const m = slug.match(/(?:^|-)((?:19|20)\d{2})(?:-|$)/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= 2100 ? y : null;
}

function toMatch(item: PlutoRawItem): PlutoMatch | null {
  if (!item._id || !item.slug || !item.name) return null;
  const type = item.type === "series" ? "series" : item.type === "movie" ? "movie" : null;
  if (!type) return null;
  const path = type === "series" ? "series" : "movies";
  return {
    id: item._id,
    slug: item.slug,
    name: item.name,
    type,
    year: yearFromSlug(item.slug),
    watchUrl: `${WATCH_BASE}/${path}/${encodeURIComponent(item.slug)}`,
  };
}

async function fetchCatalogPage(page: number): Promise<PlutoRawItem[]> {
  const url = `${PLUTO_API}?includeItems=true&deviceType=web&page=${page}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Pluto catalog ${res.status}`);
  const data = (await res.json()) as {
    categories?: { items?: PlutoRawItem[] }[];
  };
  const out: PlutoRawItem[] = [];
  for (const cat of data.categories || []) {
    for (const item of cat.items || []) out.push(item);
  }
  return out;
}

async function loadCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < CACHE_MS) {
    return catalogCache;
  }

  const pages = await Promise.all([
    fetchCatalogPage(1),
    fetchCatalogPage(2),
  ]);
  const seen = new Set<string>();
  const movies: PlutoMatch[] = [];
  const series: PlutoMatch[] = [];

  for (const item of pages.flat()) {
    const match = toMatch(item);
    if (!match || seen.has(match.id)) continue;
    seen.add(match.id);
    if (match.type === "movie") movies.push(match);
    else series.push(match);
  }

  catalogCache = { at: Date.now(), movies, series };
  return catalogCache;
}

function scoreMatch(
  candidate: PlutoMatch,
  queryNorm: string,
  year?: number | null
): number {
  const nameNorm = normalizeTitle(candidate.name);
  if (!queryNorm || !nameNorm) return -1;

  let score = 0;
  if (nameNorm === queryNorm) score += 100;
  else if (nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm)) score += 60;
  else {
    const qWords = queryNorm.split(" ").filter((w) => w.length > 2);
    const hits = qWords.filter((w) => nameNorm.includes(w)).length;
    if (hits === 0) return -1;
    score += hits * 12;
  }

  if (year && candidate.year) {
    if (candidate.year === year) score += 40;
    else if (Math.abs(candidate.year - year) <= 1) score += 10;
    else score -= 25;
  }

  return score;
}

/**
 * Busca en VOD Pluto (LATAM) por título TMDB (+ año opcional).
 */
export async function findPlutoMatch(opts: {
  title: string;
  mediaType: "movie" | "tv";
  year?: number | null;
}): Promise<PlutoMatch | null> {
  const queryNorm = normalizeTitle(opts.title);
  if (!queryNorm) return null;

  const catalog = await loadCatalog();
  const pool = opts.mediaType === "tv" ? catalog.series : catalog.movies;

  let best: PlutoMatch | null = null;
  let bestScore = 40; // umbral mínimo

  for (const item of pool) {
    const s = scoreMatch(item, queryNorm, opts.year);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }

  return best;
}
