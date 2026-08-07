/**
 * Scrapea y descarga animes desde AnimeAV1 (animeav1.com).
 *
 * Orden de prioridad:
 *   1) En emisión (status=emision) orden popular
 *   2) Populares (order=popular)
 *   3) Resto (latest_added / lo que falte)
 *
 * Uso:
 *   npx tsx scripts/scrape-animeav1.ts --catalog-only
 *   npx tsx scripts/scrape-animeav1.ts --out "G:\\Mi unidad\\veotv" --limit 20
 *   npx tsx scripts/scrape-animeav1.ts --only-airing --max-episodes 12
 *   npx tsx scripts/scrape-animeav1.ts --slug one-piece --max-episodes 3
 *   npx tsx scripts/scrape-animeav1.ts --watch --fast --interval 15
 *   npm run animeav1:watch -- --out "G:\\Mi unidad\\veotv"
 *
 * Velocidad (fibra ~500 Mbps):
 *   --fast                  → segs 24 + eps 2 + animes 2
 *   --seg-concurrency 32    → segmentos HLS en paralelo (lo que más importa)
 *   --ep-concurrency 3      → episodios del mismo anime en paralelo
 *   --concurrency 2         → animes distintos en paralelo
 *   --max-mbps 150          → techo de red (Mbps, default 150 ≈ 18.8 MB/s; 0 = sin límite)
 *   --max-mbs N             → techo en MB/s (alternativa; pisa --max-mbps)
 *
 * Descarga vía HLS Zilla (mismas cabeceras que el player). Reanudable.
 * Opcional: si hay ffmpeg en PATH, remuxea a MP4 limpio (--ffmpeg).
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { Agent, setGlobalDispatcher } from "undici";
import {
  getAnime,
  getCatalog,
  getEpisode,
  type CatalogItem,
  type Anime,
} from "animeav1-api";

const DEFAULT_OUT = "G:\\Mi unidad\\veotv";
const CACHE_DIR = join(process.cwd(), "data", "animeav1");
const ZILLA_HASH_RE =
  /zilla-networks\.com\/(?:m3u8|play)\/([a-f0-9]{32})\/?/i;

/** Pool HTTP amplio: Zilla aguanta muchas conexiones concurrentes. */
function setupHttpPool(maxConnections: number) {
  setGlobalDispatcher(
    new Agent({
      connections: Math.max(16, maxConnections),
      pipelining: 1,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
    })
  );
}

/**
 * Limita el throughput agregado (todos los segmentos/episodios).
 * bytesPerSec <= 0 → sin límite.
 */
class BandwidthLimiter {
  private tokens: number;
  private last = Date.now();
  private chain: Promise<void> = Promise.resolve();
  private transferred = 0;
  private windowStart = Date.now();

  constructor(private bytesPerSec: number) {
    this.tokens = bytesPerSec > 0 ? bytesPerSec : 0;
  }

  get enabled() {
    return this.bytesPerSec > 0;
  }

  /** Espera lo necesario para no superar el techo tras `bytes` recibidos. */
  take(bytes: number): Promise<void> {
    if (!this.enabled || bytes <= 0) return Promise.resolve();
    this.chain = this.chain.then(async () => {
      this.transferred += bytes;
      while (true) {
        const now = Date.now();
        const elapsed = Math.max(0, (now - this.last) / 1000);
        this.last = now;
        this.tokens = Math.min(
          this.bytesPerSec * 1.5,
          this.tokens + elapsed * this.bytesPerSec
        );
        if (this.tokens >= bytes) {
          this.tokens -= bytes;
          return;
        }
        const need = bytes - this.tokens;
        const waitMs = Math.ceil((need / this.bytesPerSec) * 1000);
        await sleep(Math.min(Math.max(waitMs, 5), 200));
      }
    });
    return this.chain;
  }

  /** MB/s reales en la ventana reciente (para logs). */
  recentMBs(): number {
    const secs = Math.max(0.2, (Date.now() - this.windowStart) / 1000);
    const rate = this.transferred / 1e6 / secs;
    if (secs > 8) {
      this.transferred = 0;
      this.windowStart = Date.now();
    }
    return rate;
  }
}

let bandwidthLimiter = new BandwidthLimiter((150 * 1e6) / 8); // 150 Mbps

type Bucket = "airing" | "popular" | "rest";

type InventoryItem = {
  id: number;
  slug: string;
  title: string;
  poster: string | null;
  type: string | null;
  typeSlug: string | null;
  synopsis: string;
  bucket: Bucket;
  rank: number;
};

type Progress = {
  updatedAt: string;
  doneKeys: string[];
  failed: Record<string, string>;
  stats: {
    inventoried: number;
    posters: number;
    episodes: number;
    skipped: number;
    errors: number;
  };
};

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function log(...args: unknown[]) {
  console.log(
    `[animeav1] ${new Date().toISOString()} ${args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ")}`
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function safeName(title: string) {
  return (
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.\s]+$/g, "")
      .slice(0, 80)
      .replace(/[.\s]+$/g, "") || "anime"
  );
}

function episodeKey(slug: string, ep: number) {
  return `av1:${slug}:e${ep}`;
}

function folderName(item: InventoryItem) {
  return `av1-${item.id} - ${safeName(item.title)}`;
}

function absolutePoster(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://cdn.animeav1.com${url.startsWith("/") ? url : `/${url}`}`;
}

function zillaHash(url: string): string | null {
  const m = url.match(ZILLA_HASH_RE);
  return m?.[1] || null;
}

function zillaHeaders(hash: string): Record<string, string> {
  const playRef = `https://player.zilla-networks.com/play/${hash}`;
  return {
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: playRef,
    Origin: "https://player.zilla-networks.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

function loadProgress(path: string): Progress {
  if (!existsSync(path)) {
    return {
      updatedAt: new Date().toISOString(),
      doneKeys: [],
      failed: {},
      stats: {
        inventoried: 0,
        posters: 0,
        episodes: 0,
        skipped: 0,
        errors: 0,
      },
    };
  }
  return JSON.parse(readFileSync(path, "utf8")) as Progress;
}

function saveProgress(path: string, progress: Progress) {
  progress.updatedAt = new Date().toISOString();
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(progress, null, 2), "utf8");
}

let progressBusy = Promise.resolve();
function saveProgressSafe(path: string, progress: Progress) {
  progressBusy = progressBusy.then(() => {
    saveProgress(path, progress);
  });
  return progressBusy;
}

async function fetchSegBuffer(
  abs: string,
  headers: Record<string, string>,
  retries = 3
): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(abs, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (
        buf.length < 32 ||
        buf.subarray(0, 15).toString("utf8").includes("<!DOCTYPE")
      ) {
        throw new Error("HTML/bloqueado");
      }
      await bandwidthLimiter.take(buf.length);
      return buf;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(250 * attempt);
    }
  }
  throw new Error(`seg fail ${abs.slice(0, 80)}: ${String(lastErr)}`);
}

async function mapPoolBuffers(
  count: number,
  concurrency: number,
  fn: (index: number) => Promise<Buffer>
): Promise<Buffer[]> {
  const out: Buffer[] = new Array(count);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, count) }, async () => {
      while (true) {
        const i = next++;
        if (i >= count) return;
        out[i] = await fn(i);
        done++;
      }
    })
  );
  void done;
  return out;
}

async function fetchCatalogPages(opts: {
  status?: string;
  order?: "popular" | "latest_added" | "latest_released" | "score";
  category?: string;
  maxPages: number;
  label: string;
}): Promise<CatalogItem[]> {
  const out: CatalogItem[] = [];
  const seen = new Set<number>();
  let total = Infinity;
  const prevWarn = console.warn;
  // animeav1-api loguea "Failed to parse catalog data" aunque el HTML fallback funcione
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] || "");
    if (msg.includes("Failed to parse catalog data")) return;
    prevWarn.apply(console, args as []);
  };

  try {
    for (let page = 1; page <= opts.maxPages; page++) {
      let items: CatalogItem[] = [];
      let pageTotal = 0;
      try {
        const res = await getCatalog({
          page,
          order: opts.order,
          ...(opts.status ? { status: opts.status } : {}),
          ...(opts.category ? { category: opts.category } : {}),
        });
        items = res.items || [];
        pageTotal = res.total || items.length;
        total = pageTotal;
      } catch (err) {
        log(`catálogo fail ${opts.label} p${page}`, String(err));
        break;
      }

      if (!items.length) break;
      for (const item of items) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
      log(
        `${opts.label} p${page}: +${items.length} (acum ${out.length}/${total})`
      );
      if (out.length >= total) break;
      await sleep(350);
    }
  } finally {
    console.warn = prevWarn;
  }

  return out;
}

async function buildInventory(opts: {
  maxPages: number;
  onlyAiring: boolean;
  onlyPopular: boolean;
  category?: string;
}): Promise<InventoryItem[]> {
  const byId = new Map<number, InventoryItem>();
  let rank = 0;

  const push = (items: CatalogItem[], bucket: Bucket) => {
    for (const item of items) {
      if (!item?.id || !item.slug) continue;
      if (byId.has(item.id)) continue;
      rank += 1;
      byId.set(item.id, {
        id: item.id,
        slug: item.slug,
        title: item.title,
        poster: absolutePoster(item.poster),
        type: item.type || null,
        typeSlug: item.typeSlug || null,
        synopsis: item.synopsis || "",
        bucket,
        rank,
      });
    }
  };

  // 1) En emisión populares — el slug real del filtro en animeav1 es "emision"
  if (!opts.onlyPopular) {
    push(
      await fetchCatalogPages({
        status: "emision",
        order: "popular",
        category: opts.category,
        maxPages: opts.maxPages,
        label: "emisión",
      }),
      "airing"
    );
  }

  if (opts.onlyAiring) return [...byId.values()];

  // 2) Populares generales
  push(
    await fetchCatalogPages({
      order: "popular",
      category: opts.category,
      maxPages: opts.maxPages,
      label: "populares",
    }),
    "popular"
  );

  if (opts.onlyPopular) return [...byId.values()];

  // 3) Resto (recién añadidos)
  push(
    await fetchCatalogPages({
      order: "latest_added",
      category: opts.category,
      maxPages: opts.maxPages,
      label: "resto",
    }),
    "rest"
  );

  return [...byId.values()].sort((a, b) => a.rank - b.rank);
}

async function downloadBinary(
  url: string,
  dest: string,
  headers: Record<string, string>,
  minBytes = 500
) {
  ensureDir(dirname(dest));
  if (existsSync(dest) && statSync(dest).size >= minBytes) return "skip";

  const tmp = `${dest}.part`;
  let startAt = 0;
  if (existsSync(tmp)) startAt = statSync(tmp).size;

  const res = await fetch(url, {
    headers: {
      ...headers,
      ...(startAt > 0 ? { Range: `bytes=${startAt}-` } : {}),
    },
  });
  if (!(res.status === 200 || res.status === 206) || !res.body) {
    throw new Error(`HTTP ${res.status} ${url.slice(0, 90)}`);
  }

  await pipeline(
    Readable.fromWeb(res.body as import("stream/web").ReadableStream),
    createWriteStream(tmp, { flags: startAt > 0 ? "a" : "w" })
  );

  const size = statSync(tmp).size;
  if (size < minBytes) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw new Error(`archivo pequeño (${size} B)`);
  }
  renameSync(tmp, dest);
  return "ok";
}

function parseM3u8(text: string): { init: string | null; segments: string[] } {
  const lines = text.split(/\r?\n/);
  let init: string | null = null;
  const segments: string[] = [];
  for (const line of lines) {
    const map = line.match(/#EXT-X-MAP:URI="([^"]+)"/i);
    if (map) init = map[1];
    const t = line.trim();
    if (t && !t.startsWith("#")) segments.push(t);
  }
  return { init, segments };
}

async function downloadHlsFmp4(
  m3u8Url: string,
  destMp4: string,
  label: string,
  segConcurrency = 16,
  force = false
): Promise<"ok" | "skip"> {
  ensureDir(dirname(destMp4));
  if (!force && existsSync(destMp4) && statSync(destMp4).size > 200_000) {
    return "skip";
  }
  if (force && existsSync(destMp4)) {
    try {
      unlinkSync(destMp4);
    } catch {
      /* ignore */
    }
  }

  const hash = zillaHash(m3u8Url);
  if (!hash) throw new Error("no es URL Zilla HLS");
  const headers = zillaHeaders(hash);

  const playlistRes = await fetch(m3u8Url, { headers });
  if (!playlistRes.ok) {
    throw new Error(`m3u8 ${playlistRes.status}`);
  }
  const playlist = await playlistRes.text();
  if (!playlist.includes("#EXTM3U")) {
    throw new Error("respuesta no es m3u8");
  }

  const { init, segments } = parseM3u8(playlist);
  if (!segments.length) throw new Error("m3u8 sin segmentos");

  const parallel = Math.max(1, Math.min(segConcurrency, segments.length));
  const started = Date.now();
  log(`HLS «${label}»: ${segments.length} segs · x${parallel}`);

  let initBuf: Buffer | null = null;
  if (init) {
    initBuf = await fetchSegBuffer(new URL(init, m3u8Url).toString(), headers);
  }

  let lastLog = Date.now();
  let finished = 0;
  const segBufs = await mapPoolBuffers(segments.length, parallel, async (i) => {
    const abs = new URL(segments[i], m3u8Url).toString();
    const buf = await fetchSegBuffer(abs, headers);
    finished++;
    if (Date.now() - lastLog > 4_000) {
      lastLog = Date.now();
      const mbApprox = bandwidthLimiter.recentMBs();
      log(
        `bajando «${label}»: ${finished}/${segments.length} (${Math.round(
          (finished / segments.length) * 100
        )}%) ~${mbApprox.toFixed(0)} MB/s`
      );
    }
    return buf;
  });

  const tmp = `${destMp4}.part`;
  if (existsSync(tmp)) unlinkSync(tmp);
  const out = createWriteStream(tmp);
  const writeBuf = (buf: Buffer) =>
    new Promise<void>((resolveWrite, reject) => {
      out.write(buf, (err) => (err ? reject(err) : resolveWrite()));
    });

  if (initBuf) await writeBuf(initBuf);
  for (const buf of segBufs) await writeBuf(buf);

  await new Promise<void>((resolveClose, reject) => {
    out.end((err: Error | null | undefined) =>
      err ? reject(err) : resolveClose()
    );
  });

  const size = statSync(tmp).size;
  if (size < 200_000) {
    unlinkSync(tmp);
    throw new Error(`fMP4 demasiado pequeño (${size} B)`);
  }
  renameSync(tmp, destMp4);
  const secs = Math.max(0.1, (Date.now() - started) / 1000);
  log(
    `OK «${label}» ${(size / 1e6).toFixed(1)} MB en ${secs.toFixed(1)}s (${(
      size /
      1e6 /
      secs
    ).toFixed(1)} MB/s)`
  );
  return "ok";
}

async function remuxWithFfmpeg(src: string, dest: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const ff = spawn(
      "ffmpeg",
      ["-y", "-i", src, "-c", "copy", "-movflags", "+faststart", dest],
      { stdio: "ignore" }
    );
    ff.on("error", () => resolvePromise(false));
    ff.on("close", (code) => resolvePromise(code === 0 && existsSync(dest)));
  });
}

async function resolveHlsUrl(slug: string, episode: number): Promise<string | null> {
  const detail = await getEpisode(slug, episode);
  if (!detail) return null;
  const embeds = [
    ...(detail.embeds?.SUB || []),
    ...(detail.embeds?.DUB || []),
  ];
  const hls = embeds.find(
    (e) => /hls/i.test(e.server || "") || ZILLA_HASH_RE.test(e.url || "")
  );
  if (!hls?.url) return null;
  const hash = zillaHash(hls.url);
  if (!hash) return null;
  return `https://player.zilla-networks.com/m3u8/${hash}`;
}

function pickEpisodes(
  anime: Anime,
  maxEpisodes: number,
  latestFirst: boolean
): number[] {
  const nums = (anime.episodes || [])
    .map((e) => e.number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!nums.length) return [];
  if (maxEpisodes <= 0 || nums.length <= maxEpisodes) return nums;
  if (latestFirst) return nums.slice(-maxEpisodes);
  return nums.slice(0, maxEpisodes);
}

function episodeFile(dir: string, epNum: number) {
  return join(dir, `E${String(epNum).padStart(3, "0")}.mp4`);
}

function isGoodEpisode(file: string) {
  return existsSync(file) && statSync(file).size > 200_000;
}

/** Episodios ya bajados en la carpeta del anime. */
function localEpisodeSet(dir: string): Set<number> {
  const out = new Set<number>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const m = name.match(/^E(\d+)\.mp4$/i);
    if (!m) continue;
    const n = Number(m[1]);
    if (isGoodEpisode(join(dir, name))) out.add(n);
  }
  return out;
}

async function processAnime(
  outRoot: string,
  item: InventoryItem,
  progress: Progress,
  progressPath: string,
  opts: {
    downloadVideo: boolean;
    postersOnly: boolean;
    maxEpisodes: number;
    useFfmpeg: boolean;
    force: boolean;
    segConcurrency: number;
    epConcurrency: number;
    /** Solo episodios que faltan en disco (ideal para el watcher diario). */
    newOnly: boolean;
  }
) {
  const dir = join(outRoot, "anime", folderName(item));
  ensureDir(dir);

  let detail: Anime | null = null;
  try {
    detail = await getAnime(item.slug);
  } catch (err) {
    log(`detalle fail ${item.slug}`, String(err));
  }

  const meta = {
    source: "animeav1",
    id: item.id,
    slug: item.slug,
    title: detail?.title || item.title,
    aka: detail?.aka || null,
    synopsis: detail?.synopsis || item.synopsis,
    poster: absolutePoster(detail?.poster || item.poster),
    backdrop: absolutePoster(detail?.backdrop || null),
    status: detail?.status ?? null,
    statusText: detail?.statusText || (item.bucket === "airing" ? "Airing" : null),
    episodesCount: detail?.episodesCount ?? detail?.episodes?.length ?? null,
    score: detail?.score ?? null,
    malId: detail?.malId ?? null,
    genres: (detail?.genres || []).map((g) => g.name),
    category: detail?.category?.slug || item.typeSlug,
    bucket: item.bucket,
    rank: item.rank,
    scrapedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  const posterCandidates = [
    meta.poster,
    meta.id ? `https://cdn.animeav1.com/covers/${meta.id}.jpg` : null,
    meta.id ? `https://cdn.animeav1.com/backdrops/${meta.id}.jpg` : null,
    absolutePoster(detail?.backdrop || null),
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  if (posterCandidates.length) {
    let posterOk = false;
    for (const url of posterCandidates) {
      try {
        const r = await downloadBinary(
          url,
          join(dir, "poster.jpg"),
          { Referer: "https://animeav1.com/", "User-Agent": "Mozilla/5.0" },
          2_000
        );
        if (r === "ok" || r === "skip") {
          if (r === "ok") progress.stats.posters++;
          posterOk = true;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (!posterOk) log(`poster fail ${item.slug}`);
  }

  if (!opts.downloadVideo || opts.postersOnly) return;

  if (!detail?.episodes?.length) {
    progress.failed[item.slug] = "sin episodios";
    progress.stats.errors++;
    await saveProgressSafe(progressPath, progress);
    return;
  }

  const latestFirst = item.bucket === "airing" && !opts.newOnly;
  let episodes = pickEpisodes(detail, opts.maxEpisodes, latestFirst);

  if (opts.newOnly && !opts.force) {
    const have = localEpisodeSet(dir);
    const missing = episodes.filter((n) => !have.has(n));
    if (!missing.length) {
      if (hasFlag("verbose")) {
        const localMax = [...have].reduce((a, b) => Math.max(a, b), 0);
        log(
          `al día · ${item.title} (${have.size} eps${
            localMax ? `, último E${localMax}` : ""
          })`
        );
      }
      return;
    }
    episodes = missing;
    const preview =
      missing.length <= 8
        ? `E${missing.join(", E")}`
        : `E${missing.slice(0, 5).join(", E")} … E${missing[missing.length - 1]}`;
    log(`nuevos · ${item.title} · +${missing.length} cap(s): ${preview}`);
  } else {
    log(
      `${item.bucket} · ${item.title} · ${episodes.length}/${detail.episodesCount || detail.episodes.length} eps · ep×${opts.epConcurrency} seg×${opts.segConcurrency}`
    );
  }

  await mapPool(episodes, opts.epConcurrency, async (epNum) => {
    const key = episodeKey(item.slug, epNum);
    const epFile = episodeFile(dir, epNum);
    const label = `${item.title} E${epNum}`;

    if (!opts.force && progress.doneKeys.includes(key) && isGoodEpisode(epFile)) {
      progress.stats.skipped++;
      return;
    }
    if (!opts.force && isGoodEpisode(epFile)) {
      if (!progress.doneKeys.includes(key)) progress.doneKeys.push(key);
      progress.stats.skipped++;
      return;
    }

    try {
      const m3u8 = await resolveHlsUrl(item.slug, epNum);
      if (!m3u8) throw new Error("sin HLS");

      const r = await downloadHlsFmp4(
        m3u8,
        epFile,
        label,
        opts.segConcurrency,
        opts.force
      );
      if (r === "ok") {
        if (opts.useFfmpeg) {
          const clean = `${epFile}.remux.mp4`;
          const ok = await remuxWithFfmpeg(epFile, clean);
          if (ok) {
            unlinkSync(epFile);
            renameSync(clean, epFile);
          }
        }
        progress.stats.episodes++;
        if (!progress.doneKeys.includes(key)) progress.doneKeys.push(key);
        delete progress.failed[key];
      } else {
        progress.stats.skipped++;
        if (!progress.doneKeys.includes(key)) progress.doneKeys.push(key);
      }
    } catch (err) {
      progress.failed[key] = String(err);
      progress.stats.errors++;
      log(`FAIL ${label}`, String(err));
    }

    await saveProgressSafe(progressPath, progress);
  });
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
  const fast = hasFlag("fast");
  const concurrency = Math.max(
    1,
    Number(arg("concurrency", fast ? "2" : "1")) || 1
  );
  const segConcurrency = Math.max(
    1,
    Number(arg("seg-concurrency", fast ? "24" : "12")) || 12
  );
  const epConcurrency = Math.max(
    1,
    Number(arg("ep-concurrency", fast ? "2" : "1")) || 1
  );
  // Techo por defecto 150 Mbps (~18.8 MB/s) para no saturar la red compartida.
  // --max-mbps N  → megabits/s (como el plan del ISP)
  // --max-mbs N   → megabytes/s (pisa max-mbps si se pasa)
  // 0 = sin límite
  const maxMbsArg = arg("max-mbs");
  const maxMbps = Math.max(0, Number(arg("max-mbps", "150")) || 0);
  const maxMBs =
    maxMbsArg != null ? Math.max(0, Number(maxMbsArg) || 0) : null;
  const bytesPerSec =
    maxMBs != null ? maxMBs * 1e6 : (maxMbps * 1e6) / 8;
  bandwidthLimiter = new BandwidthLimiter(bytesPerSec);
  const limitLabel =
    maxMBs != null
      ? maxMBs > 0
        ? `máx ${maxMBs} MB/s`
        : "sin tope"
      : maxMbps > 0
        ? `máx ${maxMbps} Mbps (~${(maxMbps / 8).toFixed(1)} MB/s)`
        : "sin tope";
  const limit = Math.max(0, Number(arg("limit", "0")) || 0);
  const maxPages = Math.max(1, Number(arg("pages", "8")) || 8);
  const maxEpisodesRaw = arg("max-episodes", "0");
  const allEpisodes = hasFlag("all-episodes");
  const maxEpisodes = allEpisodes
    ? 0
    : Math.max(0, Number(maxEpisodesRaw) || 0);
  const catalogOnly = hasFlag("catalog-only");
  const postersOnly = hasFlag("posters-only");
  const onlyAiring = hasFlag("only-airing");
  const onlyPopular = hasFlag("only-popular");
  const useFfmpeg = hasFlag("ffmpeg");
  const force = hasFlag("force");
  const newOnly = hasFlag("new-only");
  const slugFilter = arg("slug");
  const category = arg("category") || undefined; // tv-anime | pelicula | ova | especial

  // Watcher: por defecto solo emisión + solo faltantes + todos los caps
  const watchMode = hasFlag("watch");
  const effectiveOnlyAiring = onlyAiring || watchMode;
  const effectiveNewOnly = newOnly || watchMode;
  const effectiveMaxEpisodes =
    watchMode && !arg("max-episodes") && !allEpisodes ? 0 : maxEpisodes;

  const poolSize = Math.max(
    32,
    segConcurrency * epConcurrency * concurrency + 8
  );
  setupHttpPool(poolSize);

  ensureDir(outRoot);
  ensureDir(join(outRoot, "anime"));
  ensureDir(join(outRoot, "_state"));
  ensureDir(CACHE_DIR);
  ensureDir(join(CACHE_DIR, "by-slug"));

  const progressPath = join(outRoot, "_state", "animeav1-progress.json");
  const manifestPath = join(outRoot, "_state", "animeav1-manifest.json");
  const progress = loadProgress(progressPath);

  log(`salida: ${outRoot}`);
  if (watchMode) {
    log(
      `modo: WATCH (emisión · solo caps nuevos · intervalo ${Number(arg("interval", "15")) || 15} min)`
    );
  } else {
    log(
      `modo: ${
        catalogOnly
          ? "solo inventario"
          : postersOnly
            ? "meta+pósters"
            : "meta+pósters+HLS"
      }${fast ? " · FAST" : ""}${effectiveNewOnly ? " · new-only" : ""}`
    );
  }
  if (!catalogOnly && !postersOnly) {
    log(
      `velocidad: animes×${concurrency} · eps×${epConcurrency} · segs×${segConcurrency} (pool ${poolSize})`
    );
    log(`límite red: ${limitLabel}`);
    log(
      effectiveMaxEpisodes > 0
        ? `episodios: máx ${effectiveMaxEpisodes} por anime`
        : `episodios: TODOS los capítulos de cada anime`
    );
  }

  const runCycle = async (cycle: number) => {
    if (watchMode) log(`—— ciclo #${cycle} ${new Date().toLocaleString()} ——`);

    let inventory: InventoryItem[] = [];

    if (slugFilter) {
      inventory = [
        {
          id: 0,
          slug: slugFilter,
          title: slugFilter,
          poster: null,
          type: null,
          typeSlug: null,
          synopsis: "",
          bucket: "airing",
          rank: 1,
        },
      ];
      try {
        const a = await getAnime(slugFilter);
        if (a) {
          inventory[0] = {
            id: a.id,
            slug: a.slug,
            title: a.title,
            poster: absolutePoster(a.poster),
            type: a.category?.name || null,
            typeSlug: a.category?.slug || null,
            synopsis: a.synopsis || "",
            bucket: a.status === 2 ? "airing" : "popular",
            rank: 1,
          };
        }
      } catch {
        /* keep slug stub */
      }
    } else {
      inventory = await buildInventory({
        maxPages,
        onlyAiring: effectiveOnlyAiring,
        onlyPopular,
        category,
      });
    }

    if (limit > 0) inventory = inventory.slice(0, limit);
    progress.stats.inventoried = inventory.length;

    // En watch: priorizar títulos con actividad reciente
    if (watchMode || effectiveOnlyAiring) {
      try {
        const recent = await fetchCatalogPages({
          order: "latest_released",
          status: "emision",
          category,
          maxPages: Math.min(2, maxPages),
          label: "recién-emitidos",
        });
        const bySlug = new Map(inventory.map((i) => [i.slug, i]));
        let boost = 0;
        for (const r of recent) {
          if (!r?.slug || !r.id) continue;
          const hit = bySlug.get(r.slug);
          if (hit) {
            hit.rank = -(recent.length - boost);
            boost++;
          } else {
            boost++;
            inventory.unshift({
              id: r.id,
              slug: r.slug,
              title: r.title,
              poster: absolutePoster(r.poster),
              type: r.type || null,
              typeSlug: r.typeSlug || null,
              synopsis: r.synopsis || "",
              bucket: "airing",
              rank: -boost,
            });
          }
        }
        inventory.sort((a, b) => a.rank - b.rank);
      } catch (err) {
        log("recién-emitidos fail", String(err));
      }
    }

    const catalogFile = {
      source: "animeav1",
      scrapedAt: new Date().toISOString(),
      order: ["airing", "popular", "rest"],
      count: inventory.length,
      buckets: {
        airing: inventory.filter((i) => i.bucket === "airing").length,
        popular: inventory.filter((i) => i.bucket === "popular").length,
        rest: inventory.filter((i) => i.bucket === "rest").length,
      },
      items: inventory,
    };

    writeFileSync(
      join(CACHE_DIR, "catalog.json"),
      JSON.stringify(catalogFile, null, 2),
      "utf8"
    );
    writeFileSync(manifestPath, JSON.stringify(catalogFile, null, 2), "utf8");

    log(
      `inventario: ${inventory.length} (emisión ${catalogFile.buckets.airing}, populares ${catalogFile.buckets.popular}, resto ${catalogFile.buckets.rest})`
    );

    if (catalogOnly) {
      await saveProgressSafe(progressPath, progress);
      return;
    }

    const epsBefore = progress.stats.episodes;
    await mapPool(inventory, concurrency, async (item, idx) => {
      if (!effectiveNewOnly) {
        log(`[${idx + 1}/${inventory.length}] ${item.bucket} · ${item.title}`);
      }
      try {
        await processAnime(outRoot, item, progress, progressPath, {
          downloadVideo: !postersOnly,
          postersOnly,
          maxEpisodes: effectiveMaxEpisodes,
          useFfmpeg,
          force,
          segConcurrency,
          epConcurrency,
          newOnly: effectiveNewOnly,
        });
      } catch (err) {
        progress.failed[item.slug] = String(err);
        progress.stats.errors++;
        log(`anime fail ${item.slug}`, String(err));
        await saveProgressSafe(progressPath, progress);
      }
    });

    await saveProgressSafe(progressPath, progress);
    const gained = progress.stats.episodes - epsBefore;
    log(
      `ciclo ok · +${gained} eps · total eps ${progress.stats.episodes} · skip ${progress.stats.skipped} · err ${progress.stats.errors}`
    );
  };

  if (watchMode) {
    const intervalMin = Math.max(1, Number(arg("interval", "15")) || 15);
    const once = hasFlag("once");
    let cycle = 0;
    log(`WATCH activo cada ${intervalMin} min · Ctrl+C para salir`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      cycle += 1;
      try {
        await runCycle(cycle);
      } catch (err) {
        log("ciclo error", String(err));
      }
      if (once) break;
      log(`próxima revisión en ${intervalMin} min…`);
      await sleep(intervalMin * 60_000);
    }
    return;
  }

  await runCycle(1);
}

main().catch((err) => {
  console.error("[animeav1] Error:", err);
  process.exit(1);
});
