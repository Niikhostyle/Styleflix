/**
 * Mangas populares en español (MangaDex).
 * Preferencia: caché de `scripts/scrape-mangas-es.ts` → fallback live API.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.mangadex.org";
const CACHE_DIR = path.join(process.cwd(), "data", "mangas-es");

export type MangaChapter = {
  id: string;
  chapter: string;
  title: string | null;
  pages: number | null;
  publishAt: string | null;
};

export type MangaDetail = {
  id: string;
  slug: string;
  title: string;
  titleEs: string | null;
  synopsis: string;
  poster: string | null;
  status: string | null;
  year: number | null;
  genres: string[];
  contentRating: string | null;
  lastChapter: string | null;
  chapters: MangaChapter[];
  scrapedAt?: string;
};

export type MangaCatalogEntry = {
  id: string;
  slug: string;
  title: string;
  titleEs: string | null;
  poster: string | null;
  synopsis: string;
  status: string | null;
  year: number | null;
  genres: string[];
  lastChapter: string | null;
  chapterCount: number | null;
};

type CatalogFile = {
  scrapedAt?: string;
  items: MangaCatalogEntry[];
};

function pickLocalized(
  map: Record<string, string> | undefined,
  prefer: string[] = ["es", "es-la", "en"]
): string {
  if (!map) return "";
  for (const lang of prefer) {
    if (map[lang]?.trim()) return map[lang].trim();
  }
  return Object.values(map).find((v) => v?.trim())?.trim() || "";
}

function slugify(title: string, id: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "manga"}-${id.replace(/-/g, "").slice(0, 8)}`;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function mdGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "VeoTV/1.0 (manga-catalog)",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Catálogo: caché local o MangaDex live. */
export async function getMangaEsCatalog(
  limit = 48
): Promise<MangaCatalogEntry[]> {
  const cached = await readJson<CatalogFile>(
    path.join(CACHE_DIR, "catalog.json")
  );
  if (cached?.items?.length) {
    return cached.items.slice(0, limit);
  }
  return fetchLiveCatalog(limit);
}

async function fetchLiveCatalog(limit: number): Promise<MangaCatalogEntry[]> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(32, limit)));
  params.set("order[followedCount]", "desc");
  params.append("availableTranslatedLanguage[]", "es");
  params.append("includes[]", "cover_art");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");

  const data = await mdGet<{
    data: Array<{
      id: string;
      attributes: {
        title: Record<string, string>;
        altTitles?: Record<string, string>[];
        description?: Record<string, string>;
        status?: string;
        year?: number | null;
        tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
        lastChapter?: string | null;
      };
      relationships?: Array<{
        id: string;
        type: string;
        attributes?: { fileName?: string };
      }>;
    }>;
  }>(`${API}/manga?${params}`);

  if (!data?.data?.length) return [];

  return data.data.slice(0, limit).map((m) => {
    const titleEs =
      pickLocalized(m.attributes.title, ["es", "es-la"]) ||
      m.attributes.altTitles
        ?.map((a) => pickLocalized(a, ["es", "es-la"]))
        .find(Boolean) ||
      null;
    const title =
      titleEs ||
      pickLocalized(m.attributes.title, ["en", "ja-ro"]) ||
      "Sin título";
    const cover = m.relationships?.find((r) => r.type === "cover_art");
    const fileName = cover?.attributes?.fileName;
    const poster = fileName
      ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg`
      : null;
    return {
      id: m.id,
      slug: slugify(title, m.id),
      title,
      titleEs,
      poster,
      synopsis:
        pickLocalized(m.attributes.description, ["es", "es-la", "en"]) || "",
      status: m.attributes.status || null,
      year: m.attributes.year ?? null,
      genres: (m.attributes.tags || [])
        .map((t) => pickLocalized(t.attributes?.name, ["es", "en"]))
        .filter(Boolean)
        .slice(0, 10),
      lastChapter: m.attributes.lastChapter || null,
      chapterCount: null,
    };
  });
}

export async function getMangaEsBySlug(
  slug: string
): Promise<MangaDetail | null> {
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  if (!safe) return null;

  const cached = await readJson<MangaDetail>(
    path.join(CACHE_DIR, "by-slug", `${safe}.json`)
  );
  if (cached?.id) {
    if (!cached.chapters?.length) {
      const chapters = await fetchChaptersLive(cached.id);
      return { ...cached, chapters };
    }
    return { ...cached, chapters: cached.chapters || [] };
  }

  // Buscar en índice por slug
  const catalog = await getMangaEsCatalog(80);
  const hit = catalog.find((m) => m.slug === safe);
  if (!hit) return null;

  const chapters = await fetchChaptersLive(hit.id);
  return {
    id: hit.id,
    slug: hit.slug,
    title: hit.title,
    titleEs: hit.titleEs,
    synopsis: hit.synopsis,
    poster: hit.poster,
    status: hit.status,
    year: hit.year,
    genres: hit.genres,
    contentRating: null,
    lastChapter: hit.lastChapter,
    chapters,
  };
}

async function fetchChaptersLive(mangaId: string): Promise<MangaChapter[]> {
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("translatedLanguage[]", "es");
  params.set("order[chapter]", "asc");
  params.set("includeFutureUpdates", "0");

  const data = await mdGet<{
    data: Array<{
      id: string;
      attributes: {
        chapter?: string | null;
        title?: string | null;
        pages?: number;
        publishAt?: string | null;
      };
    }>;
  }>(`${API}/manga/${mangaId}/feed?${params}`);

  if (!data?.data?.length) return [];

  const seen = new Set<string>();
  const out: MangaChapter[] = [];
  for (const ch of data.data) {
    const num = ch.attributes.chapter?.trim() || "?";
    if (seen.has(num)) continue;
    seen.add(num);
    out.push({
      id: ch.id,
      chapter: num,
      title: ch.attributes.title || null,
      pages: ch.attributes.pages ?? null,
      publishAt: ch.attributes.publishAt || null,
    });
  }
  return out;
}

/** Páginas de un capítulo (at-home MangaDex). */
export async function getMangaChapterPages(chapterId: string): Promise<{
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
} | null> {
  const id = chapterId.replace(/[^a-f0-9-]/gi, "");
  if (!id) return null;

  const data = await mdGet<{
    baseUrl: string;
    chapter: { hash: string; data: string[]; dataSaver: string[] };
  }>(`${API}/at-home/server/${id}`);

  if (!data?.baseUrl || !data.chapter?.hash) return null;
  return {
    baseUrl: data.baseUrl,
    hash: data.chapter.hash,
    data: data.chapter.data || [],
    dataSaver: data.chapter.dataSaver || [],
  };
}

export function mangaChapterImageUrls(
  pages: NonNullable<Awaited<ReturnType<typeof getMangaChapterPages>>>,
  saver = true
): string[] {
  const files = saver && pages.dataSaver.length ? pages.dataSaver : pages.data;
  const quality = saver && pages.dataSaver.length ? "data-saver" : "data";
  return files.map(
    (f) => `${pages.baseUrl}/${quality}/${pages.hash}/${f}`
  );
}
