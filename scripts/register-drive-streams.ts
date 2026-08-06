/**
 * Registra videos de la carpeta Drive `veotv` como StreamOverride.
 *
 *   npm run mirror:register -- --dry-run
 *   npm run mirror:register -- --share
 *   npm run mirror:register -- --only-movies
 *
 * Requisitos (.env.local):
 *   DATABASE_URL                  → Postgres de VeoTV (prod o local)
 *   GOOGLE_DRIVE_FOLDER_ID        → ID de "Mi unidad/veotv" (URL …/folders/ID)
 *   GOOGLE_DRIVE_CLIENT_ID
 *   GOOGLE_DRIVE_CLIENT_SECRET
 *   GOOGLE_DRIVE_REFRESH_TOKEN    → npm run mirror:drive-auth
 *
 * En Coolify (playback):
 *   GOOGLE_DRIVE_API_KEY          → archivos con enlace público (usa --share)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const DEFAULT_OUT = "G:\\Mi unidad\\veotv";
const VIDEO_EXT = /\.(mp4|m4v|mkv|webm|mov)$/i;
const AUTO_NOTE = "auto:drive-register";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  path: string;
};

type LocalCandidate = {
  mediaType: "movie" | "tv";
  category: "peliculas" | "series" | "anime";
  tmdbId: number;
  title: string;
  season: number | null;
  episode: number | null;
  fileId: string;
  fileName: string;
  drivePath: string;
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
    `[register] ${new Date().toISOString()} ${args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ")}`
  );
}

function missingEnv(keys: string[]): string[] {
  return keys.filter((k) => !(process.env[k] || "").trim());
}

async function getAccessToken(): Promise<string> {
  const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || "").trim();
  const refresh = (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "").trim();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `No se pudo renovar access_token: ${data.error || res.status} ${data.error_description || ""}`
    );
  }
  return data.access_token;
}

async function driveGet<T>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`https://www.googleapis.com/drive/v3${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Drive API ${path}: ${res.status} ${JSON.stringify(data)}`
    );
  }
  return data as T;
}

async function drivePost(
  path: string,
  token: string,
  body: unknown
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // 403 already shared / etc.
    if (res.status === 403 || res.status === 400) {
      log(`share warn ${path}`, data);
      return;
    }
    throw new Error(`Drive POST ${path}: ${res.status} ${JSON.stringify(data)}`);
  }
}

async function listChildren(
  folderId: string,
  token: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const out: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;
  do {
    const data = await driveGet<{
      files?: Array<{ id: string; name: string; mimeType: string }>;
      nextPageToken?: string;
    }>("/files", token, {
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function walkDrive(
  rootId: string,
  token: string,
  prefix = ""
): Promise<DriveFile[]> {
  const children = await listChildren(rootId, token);
  const files: DriveFile[] = [];
  for (const child of children) {
    const path = prefix ? `${prefix}/${child.name}` : child.name;
    if (child.mimeType === "application/vnd.google-apps.folder") {
      const nested = await walkDrive(child.id, token, path);
      files.push(...nested);
    } else {
      files.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
        path,
      });
    }
  }
  return files;
}

function parseTmdbFromPath(path: string): {
  category: "peliculas" | "series" | "anime" | null;
  tmdbId: number | null;
  title: string;
  season: number | null;
  episode: number | null;
} {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  let category: "peliculas" | "series" | "anime" | null = null;
  if (parts[0] === "peliculas" || parts[0] === "series" || parts[0] === "anime") {
    category = parts[0];
  }

  let tmdbId: number | null = null;
  let title = "";
  for (const p of parts) {
    const m = p.match(/^tmdb-(\d+)\s*-\s*(.+)$/i);
    if (m) {
      tmdbId = Number(m[1]);
      title = m[2].trim();
      break;
    }
  }

  const fileName = parts[parts.length - 1] || "";
  const ep =
    fileName.match(/S(\d{1,2})E(\d{1,3})/i) ||
    norm.match(/\/S(\d{1,2})\/S\d{1,2}E(\d{1,3})/i);
  const season = ep ? Number(ep[1]) : null;
  const episode = ep ? Number(ep[2]) : null;

  return { category, tmdbId, title, season, episode };
}

function isVideo(f: DriveFile): boolean {
  if (VIDEO_EXT.test(f.name)) return true;
  return (f.mimeType || "").startsWith("video/");
}

function toCandidates(files: DriveFile[]): LocalCandidate[] {
  const out: LocalCandidate[] = [];
  for (const f of files) {
    if (!isVideo(f)) continue;
    const parsed = parseTmdbFromPath(f.path);
    if (!parsed.category || !parsed.tmdbId) {
      log("skip (sin tmdb-ID en ruta)", f.path);
      continue;
    }
    const mediaType = parsed.category === "peliculas" ? "movie" : "tv";
    out.push({
      mediaType,
      category: parsed.category,
      tmdbId: parsed.tmdbId,
      title: parsed.title || f.name,
      season: mediaType === "tv" ? parsed.season : null,
      episode: mediaType === "tv" ? parsed.episode : null,
      fileId: f.id,
      fileName: f.name,
      drivePath: f.path,
    });
  }
  return out;
}

async function shareAnyone(fileId: string, token: string) {
  await drivePost(`/files/${fileId}/permissions?supportsAllDrives=true`, token, {
    role: "reader",
    type: "anyone",
  });
}

async function upsertOverride(
  prisma: PrismaClient,
  c: LocalCandidate,
  dryRun: boolean
) {
  const embedUrl = `https://drive.google.com/file/d/${c.fileId}/preview`;
  const whereSeason = c.season;
  const whereEpisode = c.episode;

  const existing = await prisma.streamOverride.findFirst({
    where: {
      mediaType: c.mediaType,
      tmdbId: c.tmdbId,
      season: whereSeason,
      episode: whereEpisode,
      notes: { startsWith: "auto:drive" },
    },
  });

  if (dryRun) {
    log(
      "dry-run",
      existing ? "UPDATE" : "CREATE",
      c.mediaType,
      c.tmdbId,
      c.season != null ? `S${c.season}E${c.episode}` : "",
      c.title,
      c.fileId
    );
    return existing ? "update" : "create";
  }

  if (existing) {
    await prisma.streamOverride.update({
      where: { id: existing.id },
      data: {
        title: c.title.slice(0, 200),
        embedUrl,
        label: "Drive",
        enabled: true,
        priority: 100,
        notes: `${AUTO_NOTE} ${c.drivePath}`.slice(0, 500),
      },
    });
    return "update";
  }

  await prisma.streamOverride.create({
    data: {
      mediaType: c.mediaType,
      tmdbId: c.tmdbId,
      season: c.season,
      episode: c.episode,
      title: c.title.slice(0, 200),
      embedUrl,
      label: "Drive",
      enabled: true,
      priority: 100,
      notes: `${AUTO_NOTE} ${c.drivePath}`.slice(0, 500),
    },
  });
  return "create";
}

function printChecklist(missing: string[]) {
  console.error(`
═══════════════════════════════════════════════════════════
  Faltan datos para registrar streams desde Drive
═══════════════════════════════════════════════════════════

Necesito que configures en .env.local (o el entorno):

1) DATABASE_URL
   → Connection string de Postgres de VeoTV (Coolify / Neon).
   → La misma que usa la app en producción si querés subir links reales.

2) GOOGLE_DRIVE_FOLDER_ID
   → Abrí Google Drive en el navegador → carpeta "veotv"
   → La URL es: https://drive.google.com/drive/folders/XXXXXXXX
   → Ese XXXXXXXX es el valor.

3) OAuth de Google (una sola vez):
   a. https://console.cloud.google.com/
   b. Crear/usar un proyecto
   c. Habilitar "Google Drive API"
   d. Pantalla de consentimiento OAuth (External + tu email de prueba)
   e. Credenciales → ID de cliente OAuth → tipo "Aplicación de escritorio"
   f. Pegá en .env.local:
        GOOGLE_DRIVE_CLIENT_ID=...
        GOOGLE_DRIVE_CLIENT_SECRET=...
   g. Corré:  npm run mirror:drive-auth
   h. Pegá el refresh token:
        GOOGLE_DRIVE_REFRESH_TOKEN=...

4) En Coolify (para que el player pueda streamear):
        GOOGLE_DRIVE_API_KEY=...   (API key con Drive API)
   Y al registrar usá --share para dejar "cualquiera con el enlace".

Faltan ahora: ${missing.join(", ") || "(ninguna — revisá el error de arriba)"}

Cuando esté listo:
  npm run mirror:register -- --dry-run
  npm run mirror:register -- --share
═══════════════════════════════════════════════════════════
`);
}

async function main() {
  const needed = [
    "DATABASE_URL",
    "GOOGLE_DRIVE_FOLDER_ID",
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REFRESH_TOKEN",
  ];
  const missing = missingEnv(needed);
  if (missing.length) {
    printChecklist(missing);
    process.exit(1);
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();
  const dryRun = hasFlag("dry-run");
  const doShare = hasFlag("share");
  const onlyMovies = hasFlag("only-movies");
  const onlySeries = hasFlag("only-series");
  const onlyAnime = hasFlag("only-anime");
  const limit = Number(arg("limit", "0") || "0");
  const outRoot = arg("out", DEFAULT_OUT) || DEFAULT_OUT;

  log("folder", folderId);
  log("dry-run", dryRun, "share", doShare);

  const token = await getAccessToken();
  log("Drive token OK — listando carpeta veotv…");

  const allFiles = await walkDrive(folderId, token);
  log(`archivos en Drive: ${allFiles.length}`);

  let candidates = toCandidates(allFiles);
  if (onlyMovies) candidates = candidates.filter((c) => c.category === "peliculas");
  if (onlySeries) candidates = candidates.filter((c) => c.category === "series");
  if (onlyAnime) candidates = candidates.filter((c) => c.category === "anime");
  if (limit > 0) candidates = candidates.slice(0, limit);

  log(`videos con tmdb-ID: ${candidates.length}`);
  if (!candidates.length) {
    console.error(`
No encontré videos con carpetas "tmdb-XXXX - Título" bajo veotv.

Estructura esperada (la del mirror:download):
  veotv/peliculas/tmdb-1081003 - Supergirl/video.mp4
  veotv/series/tmdb-XXXX - Titulo/S01/S01E01.mp4

¿La carpeta GOOGLE_DRIVE_FOLDER_ID es la raíz "veotv"?
`);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const stats = { create: 0, update: 0, shared: 0, errors: 0 };

  try {
    for (const c of candidates) {
      try {
        if (doShare && !dryRun) {
          await shareAnyone(c.fileId, token);
          stats.shared++;
        }
        const op = await upsertOverride(prisma, c, dryRun);
        if (op === "create") stats.create++;
        else stats.update++;
        log(
          op,
          c.category,
          `tmdb-${c.tmdbId}`,
          c.season != null ? `S${String(c.season).padStart(2, "0")}E${String(c.episode).padStart(2, "0")}` : "movie",
          c.title
        );
      } catch (e) {
        stats.errors++;
        log("ERROR", c.drivePath, String(e));
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  // Estado local opcional (si G: está montado)
  try {
    if (!dryRun && existsSync(outRoot)) {
      const stateDir = join(outRoot, "_state");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(
        join(stateDir, "registered.json"),
        JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            stats,
            items: candidates.map((c) => ({
              tmdbId: c.tmdbId,
              mediaType: c.mediaType,
              season: c.season,
              episode: c.episode,
              fileId: c.fileId,
              path: c.drivePath,
            })),
          },
          null,
          2
        )
      );
    }
  } catch {
    /* ignore */
  }

  log("listo", stats);
  if (dryRun) {
    log("Era dry-run: no se escribió en la DB. Sacá --dry-run para aplicar.");
  }
  if (!doShare && !dryRun) {
    log(
      "Tip: volvé a correr con --share para publicar “cualquiera con el enlace” (necesario para GOOGLE_DRIVE_API_KEY en Coolify)."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
