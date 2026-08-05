/**
 * AnimeAV1 (animeav1.com) — catálogo y embeds de episodios.
 * Preferimos SUB; el player usa iframe del embed (HLS / mirrors).
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

const PREFERRED_SERVERS = [
  "hls",
  "mp4upload",
  "streamtape",
  "vidhide",
  "yourupload",
  "mega",
];

function rankEmbed(e: AnimeAv1Embed): number {
  const name = e.server.toLowerCase();
  const idx = PREFERRED_SERVERS.findIndex(
    (s) => name === s || name.includes(s)
  );
  let score = idx >= 0 ? 100 - idx * 8 : 10;
  if (e.lang === "SUB") score += 20;
  if (/^https:\/\//i.test(e.url)) score += 5;
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
        // Bonus si el slug/title menciona la temporada pedida
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
 * Resuelve un embed reproducible para un episodio (default 1).
 */
export async function resolveAnimeAv1Embed(opts: {
  slug: string;
  episode?: number;
  preferDub?: boolean;
}): Promise<AnimeAv1Embed | null> {
  const epNum = Math.max(1, opts.episode ?? 1);
  let detail: Awaited<ReturnType<typeof getEpisode>> | null = null;
  try {
    detail = await getEpisode(opts.slug, epNum);
  } catch (err) {
    console.error(`[animeav1] episode ${opts.slug}#${epNum}`, err);
    return null;
  }
  if (!detail) return null;

  const embeds: AnimeAv1Embed[] = [];
  const push = (lang: "SUB" | "DUB", list?: { server: string; url: string }[]) => {
    for (const e of list || []) {
      if (!e?.url || !/^https:\/\//i.test(e.url)) continue;
      embeds.push({ server: e.server || "mirror", url: e.url, lang });
    }
  };

  if (opts.preferDub) {
    push("DUB", detail.embeds?.DUB);
    push("SUB", detail.embeds?.SUB);
  } else {
    push("SUB", detail.embeds?.SUB);
    push("DUB", detail.embeds?.DUB);
  }

  if (!embeds.length) return null;
  embeds.sort((a, b) => rankEmbed(b) - rankEmbed(a));
  return embeds[0];
}
