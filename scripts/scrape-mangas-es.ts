/**
 * Descarga / actualiza el catálogo de mangas populares con traducción al español
 * (MangaDex API pública) y lo guarda en data/mangas-es/ para VeoTV.
 *
 * Uso:
 *   npx tsx scripts/scrape-mangas-es.ts
 *   npx tsx scripts/scrape-mangas-es.ts --limit=48
 *   npx tsx scripts/scrape-mangas-es.ts --with-chapters
 *
 * --with-chapters: además guarda lista de capítulos ES por manga (más lento).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.mangadex.org";
const OUT_DIR = path.join(process.cwd(), "data", "mangas-es");
const BY_SLUG_DIR = path.join(OUT_DIR, "by-slug");

type MdRelationship = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
};

type MdManga = {
  id: string;
  type: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Record<string, string>[];
    description?: Record<string, string>;
    status?: string;
    year?: number | null;
    tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
    contentRating?: string;
    lastVolume?: string | null;
    lastChapter?: string | null;
  };
  relationships?: MdRelationship[];
};

type CachedManga = {
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
  followedHint: number;
  chapters?: CachedChapter[];
  scrapedAt: string;
};

type CachedChapter = {
  id: string;
  chapter: string;
  title: string | null;
  pages: number | null;
  publishAt: string | null;
};

function argValue(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickLocalized(
  map: Record<string, string> | undefined,
  prefer: string[] = ["es", "es-la", "en"]
): string {
  if (!map) return "";
  for (const lang of prefer) {
    if (map[lang]?.trim()) return map[lang].trim();
  }
  const first = Object.values(map).find((v) => v?.trim());
  return first?.trim() || "";
}

function slugify(title: string, id: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const short = id.replace(/-/g, "").slice(0, 8);
  return `${base || "manga"}-${short}`;
}

function coverUrl(manga: MdManga): string | null {
  const cover = manga.relationships?.find((r) => r.type === "cover_art");
  const fileName = cover?.attributes?.fileName as string | undefined;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg`;
}

async function mdFetch<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "VeoTV-MangaScraper/1.0 (catalog; contact=soporte)",
    },
  });
  if (res.status === 429 && attempt < 5) {
    const wait = attempt * 1500;
    console.warn(`[manga-es] rate limit, reintento en ${wait}ms…`);
    await sleep(wait);
    return mdFetch<T>(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`MangaDex ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchPopularEs(limit: number): Promise<MdManga[]> {
  const out: MdManga[] = [];
  let offset = 0;
  const pageSize = Math.min(32, limit);

  while (out.length < limit) {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    params.set("order[followedCount]", "desc");
    params.append("availableTranslatedLanguage[]", "es");
    params.append("includes[]", "cover_art");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("contentRating[]", "erotica");

    const data = await mdFetch<{ data: MdManga[]; total?: number }>(
      `${API}/manga?${params}`
    );
    if (!data.data?.length) break;
    out.push(...data.data);
    offset += data.data.length;
    if (offset >= (data.total || 0)) break;
    await sleep(250);
  }

  return out.slice(0, limit);
}

async function fetchChaptersEs(mangaId: string): Promise<CachedChapter[]> {
  const chapters: CachedChapter[] = [];
  let offset = 0;
  const limit = 100;

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("translatedLanguage[]", "es");
    params.set("order[chapter]", "asc");
    params.set("includeFutureUpdates", "0");

    const data = await mdFetch<{
      data: Array<{
        id: string;
        attributes: {
          chapter?: string | null;
          title?: string | null;
          pages?: number;
          publishAt?: string | null;
          translatedLanguage?: string;
        };
      }>;
      total?: number;
    }>(`${API}/manga/${mangaId}/feed?${params}`);

    if (!data.data?.length) break;

    for (const ch of data.data) {
      const num = ch.attributes.chapter?.trim() || "";
      if (!num && !ch.attributes.title) continue;
      chapters.push({
        id: ch.id,
        chapter: num || "?",
        title: ch.attributes.title || null,
        pages: ch.attributes.pages ?? null,
        publishAt: ch.attributes.publishAt || null,
      });
    }

    offset += data.data.length;
    if (offset >= (data.total || 0)) break;
    await sleep(200);
  }

  // Deduplicar por número de capítulo (quedarse con el primero)
  const seen = new Set<string>();
  return chapters.filter((c) => {
    const key = c.chapter;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toCached(manga: MdManga): CachedManga {
  const titleEs =
    pickLocalized(manga.attributes.title, ["es", "es-la"]) ||
    manga.attributes.altTitles
      ?.map((a) => pickLocalized(a, ["es", "es-la"]))
      .find(Boolean) ||
    null;
  const title =
    titleEs ||
    pickLocalized(manga.attributes.title, ["en", "ja-ro", "ja"]) ||
    "Sin título";
  const synopsis =
    pickLocalized(manga.attributes.description, ["es", "es-la", "en"]) || "";
  const genres = (manga.attributes.tags || [])
    .map((t) => pickLocalized(t.attributes?.name, ["es", "en"]))
    .filter(Boolean)
    .slice(0, 12);

  return {
    id: manga.id,
    slug: slugify(title, manga.id),
    title,
    titleEs,
    synopsis,
    poster: coverUrl(manga),
    status: manga.attributes.status || null,
    year: manga.attributes.year ?? null,
    genres,
    contentRating: manga.attributes.contentRating || null,
    lastChapter: manga.attributes.lastChapter || null,
    followedHint: 0,
    scrapedAt: new Date().toISOString(),
  };
}

async function main() {
  const limit = Math.min(120, Math.max(8, Number(argValue("limit", "40")) || 40));
  const withChapters = hasFlag("with-chapters");

  console.log(`[manga-es] Descargando hasta ${limit} mangas populares (ES)…`);
  if (withChapters) console.log("[manga-es] Incluyendo capítulos (--with-chapters)");

  await mkdir(BY_SLUG_DIR, { recursive: true });

  const raw = await fetchPopularEs(limit);
  const catalog: CachedManga[] = [];

  for (let i = 0; i < raw.length; i++) {
    const manga = raw[i];
    const cached = toCached(manga);
    cached.followedHint = raw.length - i;

    if (withChapters) {
      try {
        cached.chapters = await fetchChaptersEs(manga.id);
        console.log(
          `  [${i + 1}/${raw.length}] ${cached.title} · ${cached.chapters.length} caps`
        );
      } catch (err) {
        console.warn(`  [${i + 1}] caps falló: ${cached.title}`, err);
        cached.chapters = [];
      }
      await sleep(300);
    } else {
      console.log(`  [${i + 1}/${raw.length}] ${cached.title}`);
    }

    catalog.push(cached);
    await writeFile(
      path.join(BY_SLUG_DIR, `${cached.slug}.json`),
      JSON.stringify(cached, null, 2),
      "utf8"
    );
  }

  const index = {
    source: "mangadex",
    language: "es",
    scrapedAt: new Date().toISOString(),
    count: catalog.length,
    withChapters,
    items: catalog.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      titleEs: m.titleEs,
      poster: m.poster,
      synopsis: m.synopsis.slice(0, 280),
      status: m.status,
      year: m.year,
      genres: m.genres,
      lastChapter: m.lastChapter,
      chapterCount: m.chapters?.length ?? null,
    })),
  };

  await writeFile(
    path.join(OUT_DIR, "catalog.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );

  console.log(`[manga-es] OK → ${path.join(OUT_DIR, "catalog.json")} (${catalog.length})`);
  console.log("[manga-es] En la app: /mangas  ·  fila «Mangas en español» en home");
}

main().catch((err) => {
  console.error("[manga-es] Error:", err);
  process.exit(1);
});
