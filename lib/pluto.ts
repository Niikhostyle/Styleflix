/**
 * Pluto TV (LATAM) — catálogo VOD + stream HLS (sin abrir su web).
 */

export type PlutoMatch = {
  id: string;
  slug: string;
  name: string;
  type: "movie" | "series";
  year: number | null;
  /** @deprecated no usar: abre la web de Pluto */
  watchUrl: string;
};

type PlutoRawItem = {
  _id?: string;
  slug?: string;
  name?: string;
  type?: string;
};

type BootVodMovie = {
  id?: string;
  type?: string;
  stitched?: { path?: string };
};

type BootVodSeries = {
  id?: string;
  type?: string;
  seasons?: Array<{
    number?: number;
    episodes?: Array<{
      _id?: string;
      number?: number;
      season?: number;
      stitched?: { path?: string };
    }>;
  }>;
};

const PLUTO_API = "https://api.pluto.tv/v3/vod/categories";
const WATCH_BASE = "https://pluto.tv/latam/on-demand";
const BOOT_URL = "https://boot.pluto.tv/v4/start";
const APP_VERSION = "5.113.0";

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
  const type =
    item.type === "series" ? "series" : item.type === "movie" ? "movie" : null;
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
  // Respuestas ~2–9 MB: Next.js Data Cache solo admite ≤2 MB.
  // Usamos caché en memoria (catalogCache) en loadCatalog().
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
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

  // 2 páginas bastan para un índice usable; 4×9 MB satura memoria/red.
  const pages = await Promise.all(
    [1, 2].map((page) => fetchCatalogPage(page).catch(() => []))
  );
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
  else if (nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm))
    score += 60;
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

export async function getPlutoCatalog(): Promise<{
  movies: PlutoMatch[];
  series: PlutoMatch[];
}> {
  try {
    const catalog = await loadCatalog();
    return { movies: catalog.movies, series: catalog.series };
  } catch (err) {
    console.error("[pluto] catálogo no disponible", err);
    return { movies: [], series: [] };
  }
}

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
  let bestScore = 40;

  for (const item of pool) {
    const s = scoreMatch(item, queryNorm, opts.year);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }

  return best;
}

function isAllowedPlutoHost(hostname: string) {
  return (
    hostname === "pluto.tv" ||
    hostname.endsWith(".pluto.tv") ||
    hostname.endsWith(".plutotv.net")
  );
}

export function isPlutoStreamUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:" && isAllowedPlutoHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Resuelve HLS master de un título Pluto (película o episodio).
 * No usa la web de pluto.tv — solo el stitcher.
 */
export async function resolvePlutoHlsUrl(opts: {
  match: PlutoMatch;
  season?: number;
  episode?: number;
}): Promise<string | null> {
  const clientID = crypto.randomUUID();
  const params = new URLSearchParams({
    appName: "web",
    appVersion: APP_VERSION,
    clientID,
    clientModelNumber: "1.0",
    deviceVersion: "chrome",
    deviceType: "web",
    deviceMake: "chrome",
    deviceModel: "web",
    deviceId: clientID,
    deviceDNT: "1",
  });

  if (opts.match.type === "series") {
    params.set("seriesIDs", opts.match.id);
  } else {
    params.set("episodeIDs", opts.match.id);
  }

  const bootRes = await fetch(`${BOOT_URL}?${params}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!bootRes.ok) return null;
  const boot = (await bootRes.json()) as {
    servers?: { stitcher?: string };
    session?: { sessionID?: string };
    VOD?: Record<string, BootVodMovie | BootVodSeries>;
  };

  const stitcher = boot.servers?.stitcher;
  const sid = boot.session?.sessionID;
  if (!stitcher) return null;

  let path: string | undefined;

  if (opts.match.type === "movie") {
    const entry = Object.values(boot.VOD || {}).find(
      (v) => (v as BootVodMovie).id === opts.match.id
    ) as BootVodMovie | undefined;
    path = entry?.stitched?.path;
  } else {
    const entry = Object.values(boot.VOD || {}).find(
      (v) => (v as BootVodSeries).id === opts.match.id
    ) as BootVodSeries | undefined;
    const wantSe = opts.season ?? 1;
    const wantEp = opts.episode ?? 1;
    const season =
      entry?.seasons?.find((s) => s.number === wantSe) || entry?.seasons?.[0];
    const ep =
      season?.episodes?.find((e) => e.number === wantEp) ||
      season?.episodes?.[0];
    path = ep?.stitched?.path;
  }

  if (!path) return null;

  const qs = new URLSearchParams({
    deviceType: "web",
    deviceMake: "chrome",
    deviceModel: "web",
    deviceId: clientID,
    deviceVersion: "chrome",
    appName: "web",
    appVersion: APP_VERSION,
    deviceDNT: "1",
    serverSideAds: "true",
  });
  if (sid) qs.set("sid", sid);

  return `${stitcher}${path}?${qs}`;
}

/**
 * Reescribe una playlist m3u8 para que segmentos/URIs pasen por nuestro proxy.
 */
export function rewritePlutoPlaylist(
  body: string,
  playlistUrl: string,
  proxyBase: string
): string {
  const base = new URL(playlistUrl);
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
          const abs = new URL(uri, base).toString();
          return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
        });
      }
      const abs = new URL(trimmed, base).toString();
      return `${proxyBase}${encodeURIComponent(abs)}`;
    })
    .join("\n");
}
