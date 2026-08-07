/**
 * Cliente YupManga (https://www.yupmanga.com) — mangas/manhwa en español.
 * Cloudflare bloquea undici/Node fetch → HTTP vía binario curl (+ cookie jar).
 * Lectura: chapter_key → challenge (webcrypto) → open_chapter.php → image-proxy-v2.
 */

import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

export const YUP_BASE = "https://www.yupmanga.com";
const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const CACHE_DIR = path.join(process.cwd(), "data", "mangas-es");
const JAR_PATH = path.join(os.tmpdir(), `veotv-yupmanga-${process.pid}.jar`);

export type YupMangaEntry = {
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
  source: "yupmanga";
};

export type YupChapter = {
  /** data-chapter-key (p.ej. "1.00") — lo usa open_chapter.php */
  id: string;
  chapter: string;
  title: string | null;
  pages: number | null;
  publishAt: string | null;
};

export type YupMangaDetail = YupMangaEntry & {
  chapters: YupChapter[];
  contentRating: string | null;
  scrapedAt?: string;
};

function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** HTTP con curl (evita TLS fingerprint de undici / CF 403). */
export function yupRequest(opts: {
  url: string;
  method?: "GET" | "POST";
  form?: Record<string, string>;
  headers?: string[];
  binaryOut?: string;
}): { status: number; body: string; ok: boolean } {
  const args: string[] = [
    "-sL",
    "--max-time",
    "60",
    "-A",
    UA,
    "-c",
    JAR_PATH,
    "-b",
    JAR_PATH,
    "-H",
    "Accept-Language: es-ES,es;q=0.9,en;q=0.8",
    "-H",
    `Referer: ${YUP_BASE}/`,
  ];
  for (const h of opts.headers || []) args.push("-H", h);

  if (opts.method === "POST") {
    for (const [k, v] of Object.entries(opts.form || {})) {
      args.push("--data-urlencode", `${k}=${v}`);
    }
  }

  if (opts.binaryOut) {
    args.push("-o", opts.binaryOut, "-w", "%{http_code}", opts.url);
    const r = spawnSync(curlBin(), args, {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    if (r.error) throw r.error;
    const status = Number((r.stdout || "").trim()) || 0;
    return { status, body: "", ok: status >= 200 && status < 300 };
  }

  args.push(
    "-H",
    "Accept: text/html,application/json,*/*",
    "-w",
    "\n__HTTP_STATUS__:%{http_code}",
    opts.url
  );
  const r = spawnSync(curlBin(), args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  const out = r.stdout || "";
  const m = out.match(/\n__HTTP_STATUS__:(\d+)\s*$/);
  const status = m ? Number(m[1]) : 0;
  const body = m ? out.slice(0, m.index) : out;
  return { status, body, ok: status >= 200 && status < 300 };
}

export function slugifyYup(title: string, id: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `yup-${base || "manga"}-${id.slice(0, 8).toLowerCase()}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractCsrf(html: string): string {
  return (
    html.match(/id=["']csrf_token["']\s+value=["']([^"']+)/)?.[1] ||
    html.match(/name=["']csrf-token["'][^>]*content=["']([^"']+)/)?.[1] ||
    ""
  );
}

function extractAgK(html: string): string {
  const fromCharCode = html.match(
    /meta\[name=["']ag-k["']\]'\)\.content=String\.fromCharCode\(([^)]+)\)/i
  )?.[1];
  if (fromCharCode) {
    return fromCharCode
      .split(",")
      .map((n) => String.fromCharCode(Number(n.trim())))
      .join("");
  }
  return (
    html.match(/meta\s+name=["']ag-k["'][^>]*content=["']([^"']*)["']/i)?.[1] ||
    ""
  );
}

async function solveChallengeJs(
  challengeJs: string,
  agk: string
): Promise<string> {
  const code = `
    var document = {
      getElementById: function(){ return null; },
      querySelector: function(sel){
        if (String(sel).indexOf('ag-k') !== -1) return { content: ${JSON.stringify(agk)} };
        return null;
      },
      querySelectorAll: function(){ return []; }
    };
    var window = globalThis;
    var atob = function(input) {
      return Buffer.from(String(input).replace(/=+$/, ''), 'base64').toString('binary');
    };
    (function(){ ${challengeJs} })();
  `;
  const result = vm.runInNewContext(
    code,
    {
      Buffer,
      crypto: webcrypto,
      Uint8Array,
      Array,
      String,
      Math,
      console: { log() {}, warn() {}, error() {} },
    },
    { timeout: 15000 }
  );
  return String(await Promise.resolve(result));
}

function parseComicCards(html: string): YupMangaEntry[] {
  const out: YupMangaEntry[] = [];
  const blocks = html.split(/class="[^"]*comic-card[^"]*"/i).slice(1);
  for (const block of blocks) {
    const id = block.match(/series\.php\?id=([A-Z0-9]+)/i)?.[1];
    if (!id) continue;
    const title =
      decodeEntities(
        block.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/i)?.[1]?.trim() || ""
      ) || null;
    if (!title) continue;
    const img =
      block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1] || null;
    const poster = img
      ? img.startsWith("http")
        ? img
        : `${YUP_BASE}${img.startsWith("/") ? "" : "/"}${img}`
      : null;
    out.push({
      id,
      slug: slugifyYup(title, id),
      title,
      titleEs: title,
      poster,
      synopsis: "",
      status: null,
      year: null,
      genres: [],
      lastChapter: null,
      chapterCount: null,
      source: "yupmanga",
    });
  }
  return out;
}

async function ensureSeriesSession(seriesId: string): Promise<{
  csrf: string;
  agk: string;
}> {
  const res = yupRequest({ url: `${YUP_BASE}/series.php?id=${seriesId}` });
  if (!res.ok) throw new Error(`YupManga series ${res.status}`);
  return { csrf: extractCsrf(res.body), agk: extractAgK(res.body) };
}

export async function fetchYupPopular(limit = 48): Promise<YupMangaEntry[]> {
  const byId = new Map<string, YupMangaEntry>();

  const top = yupRequest({ url: `${YUP_BASE}/top` });
  if (top.ok) {
    for (const m of parseComicCards(top.body)) byId.set(m.id, m);
  }

  for (let page = 1; page <= 8 && byId.size < limit; page++) {
    const res = yupRequest({
      url: page === 1 ? `${YUP_BASE}/` : `${YUP_BASE}/?page=${page}`,
    });
    if (!res.ok) break;
    for (const m of parseComicCards(res.body)) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
    await sleep(200);
  }

  if (byId.size < limit) {
    const all = yupRequest({ url: `${YUP_BASE}/all` });
    if (all.ok) {
      for (const m of parseComicCards(all.body)) {
        if (!byId.has(m.id)) byId.set(m.id, m);
      }
    }
  }

  return [...byId.values()].slice(0, limit);
}

export async function fetchYupMangaDetails(
  seriesId: string
): Promise<Omit<YupMangaDetail, "chapters"> | null> {
  const res = yupRequest({ url: `${YUP_BASE}/series.php?id=${seriesId}` });
  if (!res.ok) return null;
  const html = res.body;
  const title =
    decodeEntities(
      html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i)?.[1]?.trim() || ""
    ) || "Sin título";
  const synopsis =
    decodeEntities(
      html
        .match(/id=["']synopsisText["'][^>]*>\s*([\s\S]*?)\s*<\/p>/i)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || ""
    ) || "";
  const poster =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/name=["']thumbnail["'][^>]*content=["']([^"']+)/i)?.[1] ||
    null;
  const genres = [
    ...html.matchAll(/class=["'][^"']*genre-tag[^"']*["'][^>]*>\s*([^<]+)/gi),
  ].map((m) => decodeEntities(m[1].trim()));

  return {
    id: seriesId,
    slug: slugifyYup(title, seriesId),
    title,
    titleEs: title,
    poster: poster ? decodeEntities(poster) : null,
    synopsis,
    status: null,
    year: null,
    genres,
    lastChapter: null,
    chapterCount: null,
    contentRating: null,
    source: "yupmanga",
  };
}

export async function fetchYupChapters(
  seriesId: string
): Promise<YupChapter[]> {
  await ensureSeriesSession(seriesId);
  const out: YupChapter[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 40) {
    const res = yupRequest({
      url: `${YUP_BASE}/ajax/load_chapters.php?series_id=${encodeURIComponent(seriesId)}&page=${page}&order=oldest_first`,
      headers: ["X-Requested-With: XMLHttpRequest"],
    });
    if (!res.ok) break;
    let json: {
      html?: string;
      currentPage?: number;
      totalPages?: number;
    };
    try {
      json = JSON.parse(res.body);
    } catch {
      break;
    }
    totalPages = Number(json.totalPages || 1);
    const html = json.html || "";
    const cards = html.split(/class="[^"]*comic-card[^"]*"/i).slice(1);
    for (const block of cards) {
      const key = block.match(/data-chapter-key=["']([^"']+)["']/i)?.[1];
      if (!key) continue;
      const name =
        decodeEntities(
          block.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/i)?.[1]?.trim() || ""
        ) || `Capítulo ${key}`;
      const pagesHint = block.match(/<span[^>]*>\s*(\d+)\s*<\/span>/i)?.[1];
      out.push({
        id: key,
        chapter: key.replace(/\.0+$/, "") || key,
        title: name,
        pages: pagesHint ? Number(pagesHint) : null,
        publishAt: null,
      });
    }
    page += 1;
    await sleep(150);
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/** Resuelve token + URLs image-proxy-v2 (flujo chapter_key → open_chapter). */
export async function fetchYupChapterPageUrls(
  seriesId: string,
  chapterKey: string
): Promise<{ chapterId: string; token: string; urls: string[] } | null> {
  const { agk, csrf } = await ensureSeriesSession(seriesId);
  const headers = [
    "X-Requested-With: XMLHttpRequest",
    ...(csrf ? [`X-CSRF-Token: ${csrf}`] : []),
  ];

  const challengeRes = yupRequest({
    url: `${YUP_BASE}/ajax/get_challenge.php`,
    method: "POST",
    form: { chapter_key: chapterKey, s: seriesId },
    headers,
  });
  if (!challengeRes.ok) return null;
  let challenge: {
    success?: boolean;
    challenge_id?: string;
    challenge_js?: string;
  };
  try {
    challenge = JSON.parse(challengeRes.body);
  } catch {
    return null;
  }
  if (!challenge.success || !challenge.challenge_id || !challenge.challenge_js) {
    return null;
  }

  let answer = "";
  try {
    answer = await solveChallengeJs(challenge.challenge_js, agk);
  } catch {
    return null;
  }

  const openRes = yupRequest({
    url: `${YUP_BASE}/ajax/open_chapter.php`,
    method: "POST",
    form: {
      chapter_key: chapterKey,
      s: seriesId,
      challenge_id: challenge.challenge_id,
      answer,
    },
    headers,
  });
  if (!openRes.ok) return null;
  let openDto: {
    success?: boolean;
    token?: string;
    chapter_id?: string;
  };
  try {
    openDto = JSON.parse(openRes.body);
  } catch {
    return null;
  }
  if (!openDto.success || !openDto.token || !openDto.chapter_id) return null;

  const realChapterId = openDto.chapter_id;
  const token = openDto.token;

  const reader = yupRequest({
    url: `${YUP_BASE}/reader_v2.php?chapter=${encodeURIComponent(realChapterId)}&token=${encodeURIComponent(token)}&page=1`,
  });
  if (!reader.ok) return null;

  const totalPages = Number(
    reader.body.match(/totalPages\s*[:=]\s*(\d+)/)?.[1] ||
      reader.body.match(/["']totalPages["']\s*:\s*(\d+)/)?.[1] ||
      0
  );

  const count = totalPages > 0 ? totalPages : 80;
  const urls = Array.from({ length: count }, (_, i) => {
    const page = i + 1;
    return `${YUP_BASE}/image-proxy-v2.php?chapter=${encodeURIComponent(realChapterId)}&page=${page}&token=${encodeURIComponent(token)}&context=reader`;
  });
  return { chapterId: realChapterId, token, urls };
}

export function isAllowedYupImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "www.yupmanga.com" || u.hostname === "yupmanga.com") &&
      (u.pathname.includes("image-proxy") ||
        u.pathname.startsWith("/uploads") ||
        u.pathname.startsWith("/img"))
    );
  } catch {
    return false;
  }
}

export function downloadYupImage(url: string, dest: string): boolean {
  const res = yupRequest({ url, binaryOut: dest });
  return res.ok && existsSync(dest);
}

type CatalogFile = {
  scrapedAt?: string;
  items: YupMangaEntry[];
  source?: string;
};

let mem: { at: number; items: YupMangaEntry[] } | null = null;
const MEM_TTL = 20 * 60 * 1000;

export async function getYupMangaCatalog(
  limit = 48
): Promise<YupMangaEntry[]> {
  if (mem && Date.now() - mem.at < MEM_TTL && mem.items.length) {
    return mem.items.slice(0, limit);
  }

  try {
    const raw = await readFile(path.join(CACHE_DIR, "catalog.json"), "utf8");
    const cached = JSON.parse(raw) as CatalogFile;
    if (cached?.items?.length && cached.source === "yupmanga") {
      mem = { at: Date.now(), items: cached.items };
      return cached.items.slice(0, limit);
    }
  } catch {
    /* live */
  }

  const live = await fetchYupPopular(limit);
  if (live.length) mem = { at: Date.now(), items: live };
  return live.slice(0, limit);
}

export async function getYupMangaBySlug(
  slug: string
): Promise<YupMangaDetail | null> {
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  if (!safe) return null;

  try {
    const raw = await readFile(
      path.join(CACHE_DIR, "by-slug", `${safe}.json`),
      "utf8"
    );
    const cached = JSON.parse(raw) as YupMangaDetail;
    if (cached?.id && cached.source === "yupmanga") {
      if (!cached.chapters?.length) {
        const chapters = await fetchYupChapters(cached.id);
        return { ...cached, chapters };
      }
      return cached;
    }
  } catch {
    /* live */
  }

  const catalog = await getYupMangaCatalog(120);
  const hit = catalog.find((m) => m.slug === safe);
  if (!hit) return null;

  const [details, chapters] = await Promise.all([
    fetchYupMangaDetails(hit.id),
    fetchYupChapters(hit.id),
  ]);
  if (!details) return null;
  return {
    ...details,
    slug: hit.slug,
    chapters,
    contentRating: null,
  };
}

export async function writeYupCatalogCache(items: YupMangaEntry[]) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    path.join(CACHE_DIR, "catalog.json"),
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), source: "yupmanga", items },
      null,
      2
    ),
    "utf8"
  );
}
