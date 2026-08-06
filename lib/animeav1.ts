/**
 * AnimeAV1 (animeav1.com) — catálogo y embeds de episodios.
 * HLS (Zilla) es el principal vía proxy /api/play/animeav1-hls.
 */

import {
  getCatalog,
  getEpisode,
  searchAnime,
  type CatalogItem as Av1CatalogItem,
} from "animeav1-api";
import { normalizeTitle, scoreTitleMatch } from "@/lib/sources/match";

export type AnimeAv1Match = {
  id: number;
  slug: string;
  title: string;
  poster: string | null;
  typeSlug: string | null;
};

export type AnimeAv1Embed = {
  server: string;
  url: string;
  lang: "SUB" | "DUB";
};

/** HLS primero (como en AnimeAV1); resto como fallback iframe. */
const PREFERRED_SERVERS = [
  "hls",
  "upnshare",
  "mega",
  "terabox",
  "mp4upload",
  "streamtape",
  "vidhide",
  "yourupload",
  "voe",
  "filemoon",
  "dood",
];

const ZILLA_HASH_RE =
  /zilla-networks\.com\/(?:m3u8|play)\/([a-f0-9]{32})\/?/i;

export function isAnimeAv1ZillaUrl(url: string): boolean {
  return ZILLA_HASH_RE.test(url);
}

export function isAnimeAv1HlsUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    isAnimeAv1ZillaUrl(u) ||
    u.includes(".m3u8") ||
    u.includes("application/x-mpegurl")
  );
}

export function animeAv1ZillaHash(url: string): string | null {
  const m = url.match(ZILLA_HASH_RE);
  return m?.[1] || null;
}

/** Playlist HLS real (no la página /play/). */
export function animeAv1M3u8Url(url: string): string {
  const hash = animeAv1ZillaHash(url);
  if (hash) return `https://player.zilla-networks.com/m3u8/${hash}`;
  return url;
}

/** Página JWPlayer (solo útil con Referer animeav1.com). */
export function animeAv1PlayUrl(url: string): string {
  const hash = animeAv1ZillaHash(url);
  if (hash) return `https://player.zilla-networks.com/play/${hash}`;
  return url;
}

/** Cache-bust sin romper hashes (#) de UPNShare/Mega. */
export function withCacheBust(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("_r", String(Date.now()));
    return u.toString();
  } catch {
    return url;
  }
}

function rankEmbed(e: AnimeAv1Embed): number {
  const name = e.server.toLowerCase();
  const idx = PREFERRED_SERVERS.findIndex(
    (s) => name === s || name.includes(s)
  );
  let score = idx >= 0 ? 100 - idx * 8 : 10;
  if (e.lang === "SUB") score += 20;
  if (/^https:\/\//i.test(e.url)) score += 5;
  if (name === "hls" || isAnimeAv1ZillaUrl(e.url)) score += 30;
  return score;
}

export async function fetchAnimeAv1CatalogPages(opts?: {
  pages?: number;
  order?: "popular" | "latest_added" | "score" | "latest_released";
  category?: string;
}): Promise<Av1CatalogItem[]> {
  const pages = Math.max(1, opts?.pages ?? 3);
  const order = opts?.order ?? "popular";
  const out: Av1CatalogItem[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= pages; page++) {
    try {
      const { items } = await getCatalog({
        page,
        order,
        ...(opts?.category ? { category: opts.category } : {}),
      });
      for (const item of items || []) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
      if (!items?.length) break;
    } catch (err) {
      console.error(`[animeav1] catalog page ${page}`, err);
      break;
    }
  }

  return out;
}

export async function findAnimeAv1Match(opts: {
  title: string;
  year?: number | null;
  season?: number | null;
}): Promise<AnimeAv1Match | null> {
  const query = opts.title.trim();
  if (!query) return null;

  const queries = [query];
  if (opts.season && opts.season > 1) {
    queries.unshift(`${query} ${opts.season}`);
    queries.unshift(`${query} season ${opts.season}`);
    queries.unshift(`${query} ${opts.season}nd season`);
    queries.unshift(`${query} ${opts.season}rd season`);
    queries.unshift(`${query} ${opts.season}th season`);
  }

  let best: Av1CatalogItem | null = null;
  let bestScore = 45;

  for (const q of queries) {
    const queryNorm = normalizeTitle(q);
    let results: Av1CatalogItem[] = [];
    try {
      results = await searchAnime(q);
    } catch (err) {
      console.error("[animeav1] search", q, err);
      continue;
    }

    for (const item of results || []) {
      const titles = [item.title].filter(Boolean) as string[];
      for (const t of titles) {
        const s = scoreTitleMatch(t, queryNorm, {
          queryYear: opts.year ?? null,
        });
        let score = s;
        if (opts.season && opts.season > 1) {
          const n = normalizeTitle(item.title);
          if (
            n.includes(`season ${opts.season}`) ||
            n.includes(` ${opts.season}nd`) ||
            n.includes(` ${opts.season}rd`) ||
            n.includes(` ${opts.season}th`) ||
            n.endsWith(` ${opts.season}`)
          ) {
            score += 25;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
    }
    if (bestScore >= 100) break;
  }

  if (!best?.slug) return null;
  return {
    id: best.id,
    slug: best.slug,
    title: best.title,
    poster: best.poster || null,
    typeSlug: best.typeSlug || null,
  };
}

/**
 * Lista de mirrors (un botón por servidor). HLS conserva URL m3u8.
 */
export async function listAnimeAv1Embeds(opts: {
  slug: string;
  episode?: number;
  preferDub?: boolean;
}): Promise<AnimeAv1Embed[]> {
  const epNum = Math.max(1, opts.episode ?? 1);
  let detail: Awaited<ReturnType<typeof getEpisode>> | null = null;
  try {
    detail = await getEpisode(opts.slug, epNum);
  } catch (err) {
    console.error(`[animeav1] episode ${opts.slug}#${epNum}`, err);
    return [];
  }
  if (!detail) return [];

  const embeds: AnimeAv1Embed[] = [];
  const push = (
    lang: "SUB" | "DUB",
    list?: { server: string; url: string }[]
  ) => {
    for (const e of list || []) {
      if (!e?.url || !/^https:\/\//i.test(e.url)) continue;
      const raw = e.url;
      embeds.push({
        server: e.server || "mirror",
        // HLS: playlist m3u8 (el proxy la sirve al player nativo)
        url: isAnimeAv1HlsUrl(raw) ? animeAv1M3u8Url(raw) : raw,
        lang,
      });
    }
  };

  if (opts.preferDub) {
    push("DUB", detail.embeds?.DUB);
    push("SUB", detail.embeds?.SUB);
  } else {
    push("SUB", detail.embeds?.SUB);
    push("DUB", detail.embeds?.DUB);
  }

  const byServer = new Map<string, AnimeAv1Embed>();
  for (const e of embeds) {
    const key = e.server.trim().toLowerCase() || e.url;
    if (!byServer.has(key)) byServer.set(key, e);
  }

  const unique = [...byServer.values()];
  unique.sort((a, b) => rankEmbed(b) - rankEmbed(a));
  return unique;
}

/** Mejor embed: HLS/Zilla primero. */
export async function resolveAnimeAv1Embed(opts: {
  slug: string;
  episode?: number;
  preferDub?: boolean;
}): Promise<AnimeAv1Embed | null> {
  const embeds = await listAnimeAv1Embeds(opts);
  return embeds[0] || null;
}

export function isAnimeAv1ZillaStreamUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "player.zilla-networks.com") return false;
    return /^\/(m3u8|segs|play)\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Fetch upstream Zilla (m3u8/segs) con headers que Cloudflare acepta. */
export async function fetchZillaUpstream(url: string): Promise<Response> {
  const hash = animeAv1ZillaHash(url);
  const playRef = hash
    ? `https://player.zilla-networks.com/play/${hash}`
    : "https://player.zilla-networks.com/";

  return fetch(url, {
    headers: {
      Accept: "*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: playRef,
      Origin: "https://player.zilla-networks.com",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
    cache: "no-store",
    redirect: "follow",
  });
}

export function rewriteZillaPlaylist(
  text: string,
  playlistUrl: string,
  proxyBase: string
): string {
  const base = new URL(playlistUrl);
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // #EXT-X-MAP:URI="..."
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          const abs = new URL(uri, base).toString();
          return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
        });
      }
      const abs = new URL(trimmed, base).toString();
      return `${proxyBase}${encodeURIComponent(abs)}`;
    })
    .join("\n");
}
