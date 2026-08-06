/**
 * Espejo nocturno del catálogo → Google Drive (ruta local).
 *
 *   npm run mirror:catalog
 *   npm run mirror:download -- --out "G:\\Mi unidad\\veotv" --concurrency 1
 *
 * Flujo Vimeus (mismo botón "descarga" del player):
 *   1) Embed vimeus.com → JSON embeds[]
 *   2) Preferir https://vimeos.net/embed-{id}.html (Full HD)
 *   3) Abrir https://vimeos.net/d/{id}_h
 *   4) Esperar ~5s + POST op=download_orig
 *   5) Extraer enlace directo s1.vimeos.net/...m4v.mp4
 *
 * Solo Vimeus (sin Archive.org). Reanudable vía _state/progress.json
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DEFAULT_OUT = "G:\\Mi unidad\\veotv";

type Category = "peliculas" | "series" | "anime";

type CatalogEntry = {
  key: string;
  category: Category;
  source: "vimeus";
  mediaType: "movie" | "tv";
  tmdbId: number | null;
  title: string;
  year: number | null;
  posterUrl: string | null;
  embedUrl: string | null;
  seasonsHint: number | null;
  season?: number | null;
  episode?: number | null;
};

type Progress = {
  updatedAt: string;
  doneKeys: string[];
  failed: Record<string, string>;
  stats: {
    inventoried: number;
    posters: number;
    videos: number;
    skipped: number;
    errors: number;
  };
};

type EmbedRef = {
  url: string;
  quality: string;
  lang: string;
  server: string;
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, valueRaw] = match;
      if (process.env[key]) continue;
      process.env[key] = valueRaw.trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function log(...args: unknown[]) {
  console.log(
    `[mirror] ${new Date().toISOString()} ${args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ")}`
  );
}

function safeName(input: string, max = 80): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max) || "sin-titulo"
  );
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function loadProgress(path: string): Progress {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Progress;
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      doneKeys: [],
      failed: {},
      stats: {
        inventoried: 0,
        posters: 0,
        videos: 0,
        skipped: 0,
        errors: 0,
      },
    };
  }
}

function saveProgress(path: string, p: Progress) {
  p.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(p, null, 2));
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, init?: RequestInit, retries = 4) {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

async function downloadFile(
  url: string,
  dest: string,
  minBytes = 1024,
  headers: Record<string, string> = {}
) {
  ensureDir(dirname(dest));
  if (existsSync(dest) && statSync(dest).size >= minBytes) return "skip";

  const tmp = `${dest}.part`;
  // Reanudar si hay .part parcial
  let startAt = 0;
  if (existsSync(tmp)) {
    startAt = statSync(tmp).size;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      Referer: headers.Referer || "https://vimeos.net/",
      ...(startAt > 0 ? { Range: `bytes=${startAt}-` } : {}),
      ...headers,
    },
  });
  if (!(res.status === 200 || res.status === 206) || !res.body) {
    throw new Error(`download ${res.status} ${url.slice(0, 80)}`);
  }

  const nodeStream = Readable.fromWeb(
    res.body as import("stream/web").ReadableStream
  );
  let written = startAt;
  let lastLog = Date.now();
  const destName = dest.split(/[/\\]/).pop() || dest;
  nodeStream.on("data", (chunk: Buffer | string) => {
    written += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
    if (Date.now() - lastLog > 15_000) {
      lastLog = Date.now();
      log(`bajando ${destName}: ${(written / 1e6).toFixed(0)} MB`);
    }
  });
  await pipeline(
    nodeStream,
    createWriteStream(tmp, { flags: startAt > 0 ? "a" : "w" })
  );
  const size = statSync(tmp).size;
  if (size < minBytes) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw new Error(`archivo demasiado pequeño (${size} B)`);
  }
  renameSync(tmp, dest);
  return "ok";
}

function tmdbPoster(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w500${path.startsWith("/") ? path : `/${path}`}`;
}

function playerEmbedUrl(
  category: Category,
  tmdbId: number,
  viewKey: string,
  se?: number,
  ep?: number
): string {
  const path =
    category === "anime"
      ? "/e/anime"
      : category === "series"
        ? "/e/serie"
        : "/e/movie";
  const params = new URLSearchParams({
    tmdb: String(tmdbId),
    view_key: viewKey,
    title: "VeoTV",
  });
  if (se != null) params.set("se", String(se));
  if (ep != null) params.set("ep", String(ep));
  return `https://vimeus.com${path}?${params}`;
}

type VimeusListItem = {
  tmdb_id?: number | null;
  title?: string;
  poster?: string | null;
  total_seasons?: number;
  total_episodes?: number;
  season?: number;
  episode?: number;
  year?: number | string | null;
};

async function listAllVimeus(
  kindApi: "movies" | "series" | "animes",
  category: Category
): Promise<CatalogEntry[]> {
  const apiKey = process.env.VIMEUS_API_KEY;
  const viewKey = process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY || "";
  if (!apiKey) {
    log(`skip Vimeus ${kindApi}: falta VIMEUS_API_KEY`);
    return [];
  }

  const out: CatalogEntry[] = [];
  const seen = new Set<number>();
  const maxPagesDefault = arg("tmdb") ? "3" : "80";
  const maxPages = Number(arg("max-pages", maxPagesDefault));

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://vimeus.com/api/listing/${kindApi}?page=${page}`;
    let payload: unknown;
    try {
      payload = await fetchJson(url, {
        headers: { Accept: "application/json", "X-API-Key": apiKey },
      });
    } catch (err) {
      log(`Vimeus ${kindApi} page ${page} error`, String(err));
      break;
    }

    const root = (payload || {}) as Record<string, unknown>;
    const data = (root.data ?? root) as Record<string, unknown>;
    const list = (data[kindApi] ??
      data.result ??
      data.items ??
      []) as VimeusListItem[];
    if (!Array.isArray(list) || list.length === 0) {
      log(`Vimeus ${kindApi}: fin en página ${page}`);
      break;
    }

    for (const item of list) {
      const tmdbId = Number(item.tmdb_id);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0 || seen.has(tmdbId)) continue;
      seen.add(tmdbId);
      const title = String(item.title || `tmdb-${tmdbId}`).trim();
      out.push({
        key: `${category}-vimeus-${tmdbId}`,
        category,
        source: "vimeus",
        mediaType: category === "peliculas" ? "movie" : "tv",
        tmdbId,
        title,
        year: item.year != null ? Number(item.year) || null : null,
        posterUrl: tmdbPoster(item.poster),
        embedUrl: viewKey ? playerEmbedUrl(category, tmdbId, viewKey) : null,
        seasonsHint: item.total_seasons ?? null,
      });
    }

    log(`Vimeus ${kindApi} p${page}: +${list.length} (acum ${out.length})`);
    await sleep(350);
  }

  return out;
}

/** Lee embeds[] del player Vimeus (script#data). */
async function fetchPlayerEmbeds(
  category: Category,
  tmdbId: number,
  se?: number,
  ep?: number
): Promise<EmbedRef[]> {
  const viewKey = process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY;
  if (!viewKey) throw new Error("Falta NEXT_PUBLIC_VIMEUS_VIEW_KEY");

  const url = playerEmbedUrl(category, tmdbId, viewKey, se, ep);
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    },
  });
  if (!res.ok) throw new Error(`embed HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script[^>]*id="data"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) throw new Error("sin script#data en embed");
  const data = JSON.parse(match[1].trim()) as {
    embeds?: {
      url?: string;
      quality?: string;
      lang?: string;
      server?: string;
    }[];
  };
  return (data.embeds || [])
    .filter((e) => e.url)
    .map((e) => ({
      url: e.url!,
      quality: e.quality || "",
      lang: e.lang || "",
      server: e.server || "",
    }));
}

function pickVimeosEmbedsRanked(embeds: EmbedRef[]): string[] {
  const vimeos = embeds.filter((e) => /vimeos\.net\/embed-/i.test(e.url));
  const score = (e: EmbedRef) => {
    let s = 0;
    if (/full\s*hd|1080|hd/i.test(e.quality)) s += 100;
    if (!/cam/i.test(e.quality)) s += 50;
    if (/latino|castellano|spanish/i.test(e.lang)) s += 10;
    return s;
  };
  return [...vimeos]
    .sort((a, b) => score(b) - score(a))
    .map((e) => e.url);
}

function pickBestVimeosEmbed(embeds: EmbedRef[]): string | null {
  return pickVimeosEmbedsRanked(embeds)[0] || null;
}

function embedToDownloadPage(embedUrl: string): string | null {
  // https://vimeos.net/embed-3lrsrb8yg9r7.html → /d/3lrsrb8yg9r7_h
  const m = embedUrl.match(/vimeos\.net\/embed-([a-z0-9]+)\.html/i);
  if (!m) return null;
  return `https://vimeos.net/d/${m[1]}_h`;
}

/**
 * Mismo flujo del botón Descargar del player → enlace directo temporal (12h / IP).
 */
async function resolveVimeosDirectUrl(downloadPageUrl: string): Promise<{
  directUrl: string;
  fileName: string | null;
  referer: string;
}> {
  const jar: string[] = [];
  const store = (res: Response) => {
    const list = res.headers.getSetCookie?.() || [];
    for (const c of list) jar.push(c.split(";")[0]);
  };
  const cookie = () => jar.join("; ");

  const get1 = await fetch(downloadPageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      Referer: "https://vimeus.com/",
      Cookie: cookie(),
    },
  });
  store(get1);
  const html1 = await get1.text();
  const id = (html1.match(/name="id"\s+value="([^"]+)"/) || [])[1];
  const mode = (html1.match(/name="mode"\s+value="([^"]+)"/) || [])[1] || "h";
  const hash = (html1.match(/name="hash"\s+value="([^"]+)"/) || [])[1];
  const fileName =
    (html1.match(/([A-Za-z0-9_\-]+\.m4v)/) || [])[1] ||
    (html1.match(/([A-Za-z0-9_\-]+\.mp4)/) || [])[1] ||
    null;
  if (!id || !hash) throw new Error("formulario de descarga incompleto");

  const waitMs = Number(arg("dl-wait-ms", "5500")) || 5500;
  await sleep(waitMs);

  const body = new URLSearchParams({
    op: "download_orig",
    id,
    mode,
    hash,
  });
  const post = await fetch(downloadPageUrl, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://vimeos.net",
      Referer: downloadPageUrl,
      Cookie: cookie(),
    },
    body,
    redirect: "follow",
  });
  store(post);
  const html2 = await post.text();

  // Preferir el botón oficial de enlace directo
  const fromBtn =
    (html2.match(
      /class="[^"]*download-btn[^"]*"\s+href="(https:\/\/[^"]+)"/i
    ) ||
      html2.match(
        /href="(https:\/\/[^"]+)"\s+class="[^"]*download-btn[^"]*"/i
      ) ||
      [])[1] || null;

  const fromCdn =
    (html2.match(
      /https:\/\/s\d+\.vimeos\.net\/[^"'\s<>]+/i
    ) || [])[0] ||
    (html2.match(
      /https:\/\/[^"'\s<>]*vimeos\.net\/[^"'\s<>]+\.mp4[^"'\s<>]*/i
    ) || [])[0] ||
    null;

  const direct = (fromBtn || fromCdn || "").replace(/&amp;/g, "&");
  if (!direct || !/^https:\/\//i.test(direct)) {
    throw new Error(
      "no se generó enlace directo (¿límite IP / espera / premium?)"
    );
  }
  return {
    directUrl: direct,
    fileName,
    referer: downloadPageUrl,
  };
}

async function downloadViaVimeusPlayer(
  entry: CatalogEntry,
  destFile: string
): Promise<"ok" | "skip"> {
  if (existsSync(destFile) && statSync(destFile).size > 1_000_000) return "skip";
  if (!entry.tmdbId) throw new Error("sin tmdbId");

  const embeds = await fetchPlayerEmbeds(
    entry.category,
    entry.tmdbId,
    entry.season ?? undefined,
    entry.episode ?? undefined
  );
  const ranked = pickVimeosEmbedsRanked(embeds);
  if (!ranked.length) {
    throw new Error(
      `sin mirror vimeos.net (embeds: ${embeds.map((e) => e.url).join(" | ") || "ninguno"})`
    );
  }

  let lastErr: unknown;
  for (const bestEmbed of ranked) {
    const page = embedToDownloadPage(bestEmbed);
    if (!page) continue;
    try {
      log(`vimeos dl page ${entry.key} → ${page}`);
      const { directUrl, fileName, referer } =
        await resolveVimeosDirectUrl(page);
      writeFileSync(
        `${destFile}.source.json`,
        JSON.stringify(
          {
            bestEmbed,
            page,
            directUrl,
            fileName,
            referer,
            at: new Date().toISOString(),
          },
          null,
          2
        )
      );
      log(
        `vimeos directo ${entry.key} → ${directUrl.slice(0, 90)}…` +
          (existsSync(`${destFile}.part`)
            ? ` (reanuda ${(statSync(`${destFile}.part`).size / 1e6).toFixed(0)} MB)`
            : "")
      );
      return downloadFile(directUrl, destFile, 500_000, { Referer: referer });
    } catch (err) {
      lastErr = err;
      log(`vimeos intento falló ${page}`, String(err));
      await sleep(2000);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr || "vimeos download fail"));
}

async function expandSeriesEpisodes(
  entry: CatalogEntry
): Promise<CatalogEntry[]> {
  if (entry.category === "peliculas" || !entry.tmdbId) return [entry];
  const apiKey = process.env.VIMEUS_API_KEY;
  if (!apiKey) return [entry];

  const seasons = Math.max(1, entry.seasonsHint || 1);
  const maxSeasons = Math.min(seasons, Number(arg("max-seasons", "20")) || 20);
  const out: CatalogEntry[] = [];

  for (let se = 1; se <= maxSeasons; se++) {
    try {
      const payload = await fetchJson(
        `https://vimeus.com/api/listing/episodes?page=1&tmdb_id=${entry.tmdbId}&season=${se}`,
        { headers: { Accept: "application/json", "X-API-Key": apiKey } }
      );
      const root = (payload || {}) as Record<string, unknown>;
      const data = (root.data ?? root) as Record<string, unknown>;
      const list = (data.episodes ??
        data.result ??
        data.items ??
        []) as VimeusListItem[];
      if (!Array.isArray(list) || !list.length) {
        // fallback: intentar eps 1..30 hasta fallar embeds
        for (let ep = 1; ep <= 30; ep++) {
          out.push({
            ...entry,
            key: `${entry.key}-s${se}e${ep}`,
            season: se,
            episode: ep,
            title: `${entry.title} S${String(se).padStart(2, "0")}E${String(ep).padStart(2, "0")}`,
          });
        }
        break;
      }
      for (const item of list) {
        const ep = Number(item.episode);
        if (!Number.isFinite(ep) || ep <= 0) continue;
        out.push({
          ...entry,
          key: `${entry.key}-s${se}e${ep}`,
          season: se,
          episode: ep,
          title: `${entry.title} S${String(se).padStart(2, "0")}E${String(ep).padStart(2, "0")}`,
        });
      }
      await sleep(300);
    } catch (err) {
      log(`episodes ${entry.tmdbId} s${se}`, String(err));
    }
  }

  return out.length ? out : [entry];
}

function entryDir(outRoot: string, entry: CatalogEntry): string {
  const idPart = entry.tmdbId ? `tmdb-${entry.tmdbId}` : "id-unknown";
  const base = join(
    outRoot,
    entry.category,
    `${idPart} - ${safeName(entry.title.replace(/ S\d+E\d+$/i, ""))}`
  );
  if (entry.season != null && entry.episode != null) {
    return join(base, `S${String(entry.season).padStart(2, "0")}`);
  }
  return base;
}

function videoFileName(entry: CatalogEntry): string {
  if (entry.season != null && entry.episode != null) {
    return `S${String(entry.season).padStart(2, "0")}E${String(entry.episode).padStart(2, "0")}.mp4`;
  }
  return "video.mp4";
}

async function processEntry(
  outRoot: string,
  entry: CatalogEntry,
  progress: Progress,
  opts: { downloadVideo: boolean; postersOnly: boolean },
  progressPath: string
) {
  const done = new Set(progress.doneKeys);
  if (done.has(entry.key) && !hasFlag("force")) {
    progress.stats.skipped++;
    return;
  }

  const dir = entryDir(outRoot, entry);
  ensureDir(dir);

  writeFileSync(
    join(dir, entry.episode != null ? `${videoFileName(entry)}.meta.json` : "meta.json"),
    JSON.stringify({ ...entry, mirroredAt: new Date().toISOString() }, null, 2)
  );

  if (entry.posterUrl && entry.episode == null) {
    try {
      const r = await downloadFile(entry.posterUrl, join(dir, "poster.jpg"), 500);
      if (r === "ok") progress.stats.posters++;
    } catch (err) {
      log(`poster fail ${entry.key}`, String(err));
    }
  }

  if (!opts.downloadVideo || opts.postersOnly) {
    if (!done.has(entry.key)) progress.doneKeys.push(entry.key);
    return;
  }

  const dest = join(dir, videoFileName(entry));

  try {
    const r = await downloadViaVimeusPlayer(entry, dest);
    if (r === "ok") progress.stats.videos++;
    log(`OK video ${entry.key} (${(statSync(dest).size / 1e9).toFixed(2)} GB)`);
    if (!done.has(entry.key)) progress.doneKeys.push(entry.key);
    delete progress.failed[entry.key];
  } catch (err) {
    progress.failed[entry.key] = String(err);
    progress.stats.errors++;
    log(`video fail ${entry.key}`, String(err));
  }

  saveProgress(progressPath, progress);
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
) {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    })
  );
}

async function main() {
  const outRoot = resolve(arg("out", DEFAULT_OUT)!);
  // Videos ~1–2GB: por defecto 1 a la vez
  const concurrency = Math.max(1, Number(arg("concurrency", "1")) || 1);
  const downloadVideo = !hasFlag("catalog-only");
  const postersOnly = hasFlag("posters-only");
  const catalogOnly = hasFlag("catalog-only");
  const onlyMovies = hasFlag("only-movies");
  const expandEpisodes = !hasFlag("no-episodes");

  ensureDir(outRoot);
  for (const c of ["peliculas", "series", "anime", "_state"] as const) {
    ensureDir(join(outRoot, c));
  }

  const progressPath = join(outRoot, "_state", "progress.json");
  const manifestPath = join(outRoot, "_state", "manifest.json");
  const progress = loadProgress(progressPath);

  log(`salida: ${outRoot}`);
  log(
    `modo: ${
      catalogOnly
        ? "solo inventario"
        : postersOnly
          ? "posters+meta"
          : "meta+posters+videos (Vimeos)"
    }`
  );

  const tmdbOnly = Number(arg("tmdb", "0")) || 0;
  let entries: CatalogEntry[] = [];

  if (tmdbOnly > 0) {
    // Atajo: no inventariar todo el catálogo
    const category = (arg("category", "peliculas") || "peliculas") as Category;
    const viewKey = process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY || "";
    entries = [
      {
        key: `${category}-vimeus-${tmdbOnly}`,
        category,
        source: "vimeus",
        mediaType: category === "peliculas" ? "movie" : "tv",
        tmdbId: tmdbOnly,
        title: arg("title", `tmdb-${tmdbOnly}`) || `tmdb-${tmdbOnly}`,
        year: null,
        posterUrl: null,
        embedUrl: viewKey
          ? playerEmbedUrl(category, tmdbOnly, viewKey)
          : null,
        seasonsHint: null,
      },
    ];
    log(`modo --tmdb ${tmdbOnly} (${category})`);
  } else {
    const [movies, series, animes] = await Promise.all([
      listAllVimeus("movies", "peliculas"),
      onlyMovies
        ? Promise.resolve([] as CatalogEntry[])
        : listAllVimeus("series", "series"),
      onlyMovies
        ? Promise.resolve([] as CatalogEntry[])
        : listAllVimeus("animes", "anime"),
    ]);
    const byKey = new Map<string, CatalogEntry>();
    for (const e of [...movies, ...series, ...animes]) {
      byKey.set(e.key, e);
    }
    entries = [...byKey.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "es")
    );
  }

  const limit = Number(arg("limit", "0")) || 0;
  if (limit > 0) entries = entries.slice(0, limit);

  progress.stats.inventoried = entries.length;
  writeFileSync(manifestPath, JSON.stringify(entries, null, 2));
  writeFileSync(
    join(outRoot, "_state", "summary.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        outRoot,
        counts: {
          total: entries.length,
          peliculas: entries.filter((e) => e.category === "peliculas").length,
          series: entries.filter((e) => e.category === "series").length,
          anime: entries.filter((e) => e.category === "anime").length,
          vimeus: entries.filter((e) => e.source === "vimeus").length,
        },
      },
      null,
      2
    )
  );
  log(`inventario títulos: ${entries.length}`);

  if (catalogOnly) {
    saveProgress(progressPath, progress);
    log("listo (solo catálogo)");
    return;
  }

  // Expandir episodios de series/anime al descargar
  let work: CatalogEntry[] = [];
  for (const e of entries) {
    if (
      downloadVideo &&
      !postersOnly &&
      expandEpisodes &&
      e.source === "vimeus" &&
      e.category !== "peliculas"
    ) {
      const eps = await expandSeriesEpisodes(e);
      log(`expand ${e.title}: ${eps.length} eps`);
      work.push(...eps);
    } else {
      work.push(e);
    }
  }

  if (limit > 0 && work.length > limit) {
    // Si limit aplica a títulos, no recortar eps de esos títulos
  }

  let n = 0;
  await mapPool(work, concurrency, async (entry) => {
    n++;
    if (n % 5 === 0 || entry.source === "vimeus") {
      log(
        `item ${n}/${work.length} · videos=${progress.stats.videos} err=${progress.stats.errors} · ${entry.key}`
      );
    }
    await processEntry(outRoot, entry, progress, { downloadVideo, postersOnly }, progressPath);
    await sleep(800);
  });

  saveProgress(progressPath, progress);
  log("terminado", progress.stats);
}

main().catch((err) => {
  console.error("[mirror] FATAL", err);
  process.exit(1);
});
