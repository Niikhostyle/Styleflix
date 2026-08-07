/**
 * Mangas populares en español.
 * Preferencia: YupManga → fallback MangaDex (caché scrape / live API).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getYupMangaBySlug, getYupMangaCatalog } from "@/lib/yupmanga";

const API = "https://api.mangadex.org";
const CACHE_DIR = path.join(process.cwd(), "data", "mangas-es");

/** Memoria de proceso: evita reconsultar catálogo en cada request. */
let catalogMem:
  | { at: number; items: MangaCatalogEntry[] }
  | null = null;
const CATALOG_MEM_TTL_MS = 30 * 60 * 1000;

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
  source?: "yupmanga" | "mangadex";
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
  source?: "yupmanga" | "mangadex";
};

type CatalogFile = {
  scrapedAt?: string;
  items: MangaCatalogEntry[];
  source?: string;
};

/** UUID de capítulo MangaDex (at-home). */
export function isMangaDexChapterId(id: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(id);
}

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

export function slugifyManga(title: string, id: string): string {
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

async function mdGet<T>(url: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "VeoTV/1.0 (manga-catalog; +https://veotv.cloud)",
        },
        next: { revalidate: attempt === 0 ? 1800 : 0 },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

/** Catálogo: YupManga primero; fallback MangaDex (caché o live). */
export async function getMangaEsCatalog(
  limit = 48
): Promise<MangaCatalogEntry[]> {
  if (
    catalogMem &&
    Date.now() - catalogMem.at < CATALOG_MEM_TTL_MS &&
    catalogMem.items.length
  ) {
    return catalogMem.items.slice(0, limit);
  }

  try {
    const yup = await getYupMangaCatalog(limit);
    if (yup.length) {
      const items: MangaCatalogEntry[] = yup.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        titleEs: m.titleEs,
        poster: m.poster,
        synopsis: m.synopsis,
        status: m.status,
        year: m.year,
        genres: m.genres,
        lastChapter: m.lastChapter,
        chapterCount: m.chapterCount,
        source: "yupmanga" as const,
      }));
      catalogMem = { at: Date.now(), items };
      return items.slice(0, limit);
    }
  } catch {
    /* fallback MangaDex */
  }

  const cached = await readJson<CatalogFile>(
    path.join(CACHE_DIR, "catalog.json")
  );
  // Caché YupManga no sirve como fallback MangaDex
  const fromCache =
    cached?.items?.length && cached.source !== "yupmanga"
      ? cached.items.slice(0, Math.max(limit * 2, 64)).map((m) => ({
          ...m,
          source: "mangadex" as const,
        }))
      : null;

  const items =
    fromCache ||
    (await fetchLiveCatalog(Math.max(limit * 2, 64))).map((m) => ({
      ...m,
      source: "mangadex" as const,
    }));

  catalogMem = { at: Date.now(), items };
  return items.slice(0, limit);
}

async function fetchLiveCatalog(limit: number): Promise<MangaCatalogEntry[]> {
  const candidates: MangaCatalogEntry[] = [];
  let offset = 0;
  const pageSize = 32;
  const candidateCap = Math.min(120, Math.max(limit * 2, 64));

  while (candidates.length < candidateCap && offset < 160) {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    params.set("order[followedCount]", "desc");
    params.set("hasAvailableChapters", "true");
    params.append("availableTranslatedLanguage[]", "es");
    params.append("availableTranslatedLanguage[]", "es-la");
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

    if (!data?.data?.length) break;

    for (const m of data.data) {
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
      candidates.push({
        id: m.id,
        slug: slugifyManga(title, m.id),
        title,
        titleEs,
        poster,
        synopsis:
          pickLocalized(m.attributes.description, ["es", "es-la", "en"]) ||
          "",
        status: m.attributes.status || null,
        year: m.attributes.year ?? null,
        genres: (m.attributes.tags || [])
          .map((t) => pickLocalized(t.attributes?.name, ["es", "en"]))
          .filter(Boolean)
          .slice(0, 10),
        lastChapter: m.attributes.lastChapter || null,
        chapterCount: null,
        source: "mangadex",
      });
      if (candidates.length >= candidateCap) break;
    }

    if (data.data.length < pageSize) break;
    offset += pageSize;
  }

  return candidates;
}

export async function getMangaEsBySlug(
  slug: string
): Promise<MangaDetail | null> {
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  if (!safe) return null;

  // YupManga primero (sobre todo slugs `yup-*`)
  try {
    const yup = await getYupMangaBySlug(safe);
    if (yup?.id) {
      return {
        id: yup.id,
        slug: yup.slug,
        title: yup.title,
        titleEs: yup.titleEs,
        synopsis: yup.synopsis,
        poster: yup.poster,
        status: yup.status,
        year: yup.year,
        genres: yup.genres,
        contentRating: yup.contentRating,
        lastChapter: yup.lastChapter,
        chapters: yup.chapters || [],
        scrapedAt: yup.scrapedAt,
        source: "yupmanga",
      };
    }
  } catch {
    /* fallback MangaDex */
  }

  if (safe.startsWith("yup-")) return null;

  const cached = await readJson<MangaDetail>(
    path.join(CACHE_DIR, "by-slug", `${safe}.json`)
  );
  if (cached?.id && cached.source !== "yupmanga") {
    if (!cached.chapters?.length) {
      const chapters = await fetchChaptersLive(cached.id);
      return { ...cached, chapters, source: "mangadex" };
    }
    return { ...cached, chapters: cached.chapters || [], source: "mangadex" };
  }

  // No usar getMangaEsCatalog aquí: puede estar cacheado como YupManga
  const mdCatalogFile = await readJson<CatalogFile>(
    path.join(CACHE_DIR, "catalog.json")
  );
  const mdCandidates =
    mdCatalogFile?.items?.length && mdCatalogFile.source !== "yupmanga"
      ? mdCatalogFile.items
      : await fetchLiveCatalog(80);
  const hit = mdCandidates.find((m) => m.slug === safe);
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
    source: "mangadex",
  };
}

async function fetchChaptersLive(mangaId: string): Promise<MangaChapter[]> {
  const seen = new Set<string>();
  const out: MangaChapter[] = [];
  let offset = 0;

  while (offset < 500) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("offset", String(offset));
    params.append("translatedLanguage[]", "es");
    params.append("translatedLanguage[]", "es-la");
    params.set("order[chapter]", "asc");
    params.set("includeFutureUpdates", "0");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("contentRating[]", "erotica");

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
      total?: number;
    }>(`${API}/manga/${mangaId}/feed?${params}`);

    if (!data?.data?.length) break;

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

    if (data.data.length < 100) break;
    offset += 100;
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
  if (!id || !isMangaDexChapterId(id)) return null;

  const data = await mdGet<{
    baseUrl: string;
    chapter: { hash: string; data: string[]; dataSaver: string[] };
  }>(`${API}/at-home/server/${id}`, 3);

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

/** Hosts permitidos para proxy de imágenes (MangaDex + YupManga). */
export function isAllowedMangaImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.endsWith(".mangadex.network") ||
    h === "uploads.mangadex.org" ||
    h.endsWith(".mangadex.org") ||
    h === "www.yupmanga.com" ||
    h === "yupmanga.com"
  );
}
