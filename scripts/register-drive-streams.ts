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
import { dirname, join, resolve } from "node:path";
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
  // .env.local gana siempre sobre .env (Prisma puede haber precargado .env)
  for (const file of [".env", ".env.local"]) {
    let raw: string;
    try {
      raw = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    const preferLocal = file.endsWith(".env.local");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, valueRaw] = match;
      if (process.env[key] && !preferLocal) continue;
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
  if (/\.part$/i.test(f.name)) return false; // descarga incompleta
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

  if (dryRun) {
    log(
      "dry-run",
      "UPSERT",
      c.mediaType,
      c.tmdbId,
      c.season != null ? `S${c.season}E${c.episode}` : "movie",
      c.title,
      c.fileId
    );
    return "create";
  }

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
  const dryRun = hasFlag("dry-run");
  const doShare = hasFlag("share");
  const exportPath = arg("export");
  const importPath = arg("import");
  const onlyMovies = hasFlag("only-movies");
  const onlySeries = hasFlag("only-series");
  const onlyAnime = hasFlag("only-anime");
  const limit = Number(arg("limit", "0") || "0");
  const outRoot = arg("out", DEFAULT_OUT) || DEFAULT_OUT;
  // dry-run / --export: solo Drive. --import: solo DB. normal: Drive+DB.

  if (importPath) {
    const needed = ["DATABASE_URL"];
    const missing = missingEnv(needed);
    if (missing.length) {
      printChecklist(missing);
      process.exit(1);
    }
    const raw = readFileSync(resolve(importPath), "utf8");
    const payload = JSON.parse(raw) as {
      items: Array<{
        mediaType: "movie" | "tv";
        tmdbId: number;
        title: string;
        season: number | null;
        episode: number | null;
        fileId: string;
        drivePath?: string;
        category?: LocalCandidate["category"];
      }>;
    };
    const prisma = new PrismaClient();
    const stats = { create: 0, update: 0, shared: 0, errors: 0 };
    try {
      await prisma.$queryRaw`SELECT 1`;
      for (const item of payload.items || []) {
        const c: LocalCandidate = {
          mediaType: item.mediaType,
          category: item.category || (item.mediaType === "movie" ? "peliculas" : "series"),
          tmdbId: item.tmdbId,
          title: item.title,
          season: item.season,
          episode: item.episode,
          fileId: item.fileId,
          fileName: item.fileId,
          drivePath: item.drivePath || "",
        };
        try {
          const op = await upsertOverride(prisma, c, false);
          if (op === "create") stats.create++;
          else stats.update++;
          log(op, `tmdb-${c.tmdbId}`, c.title);
        } catch (e) {
          stats.errors++;
          log("ERROR", c.title, String(e));
        }
      }
    } catch (e) {
      console.error(`
No se puede conectar a DATABASE_URL desde esta PC.

El host interno de Coolify (ej. xxx:5432) no es alcanzable desde fuera.
Opciones:
  1) En Coolify → Postgres → exponer puerto / usar URL pública y ponerla en DATABASE_URL
  2) Correr el import DENTRO del contenedor app:
       node -e ... o copiar el JSON y usar mirror:register -- --import archivo.json
`);
      console.error(e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
    log("import listo", stats);
    return;
  }

  const driveNeeded = [
    "GOOGLE_DRIVE_FOLDER_ID",
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REFRESH_TOKEN",
  ];
  const dbNeeded = dryRun || exportPath ? [] : ["DATABASE_URL"];
  const missing = missingEnv([...driveNeeded, ...dbNeeded]);
  if (missing.length) {
    printChecklist(missing);
    process.exit(1);
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();

  log("folder", folderId);
  log("dry-run", dryRun, "share", doShare, "export", exportPath || "-");

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

  const exportPayload = {
    updatedAt: new Date().toISOString(),
    count: candidates.length,
    items: candidates.map((c) => ({
      mediaType: c.mediaType,
      category: c.category,
      tmdbId: c.tmdbId,
      title: c.title,
      season: c.season,
      episode: c.episode,
      fileId: c.fileId,
      drivePath: c.drivePath,
      embedUrl: `https://drive.google.com/file/d/${c.fileId}/preview`,
    })),
  };

  if (exportPath) {
    const abs = resolve(exportPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(exportPayload, null, 2));
    log("exportado", abs, candidates.length, "items");
  }

  // Siempre guardar copia local si hay G:
  try {
    if (existsSync(outRoot)) {
      const stateDir = join(outRoot, "_state");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(
        join(stateDir, "pending-overrides.json"),
        JSON.stringify(exportPayload, null, 2)
      );
      log("también en", join(outRoot, "_state", "pending-overrides.json"));
    }
  } catch {
    /* ignore */
  }

  const stats = { create: 0, update: 0, shared: 0, errors: 0 };
  let prisma: PrismaClient | null = null;

  if (!dryRun && !exportPath) {
    prisma = new PrismaClient();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      await prisma.$disconnect().catch(() => undefined);
      console.error(`
Drive OK, pero DATABASE_URL no es alcanzable desde tu PC
(host interno Coolify tipo sk88s…:5432).

Hacé esto:
  A) Export + import en el servidor:
       npm run mirror:register -- --share --export data/drive-overrides.json
       # copiá el JSON al contenedor app y:
       npm run mirror:register -- --import data/drive-overrides.json

  B) O poné en .env.local una DATABASE_URL pública (Postgres de Coolify con puerto expuesto).
`);
      console.error(String(e));
      process.exit(1);
    }
  }

  try {
    for (const c of candidates) {
      try {
        if (doShare && !dryRun) {
          await shareAnyone(c.fileId, token);
          stats.shared++;
        }
        if (dryRun) {
          await upsertOverride(null as unknown as PrismaClient, c, true);
          stats.create++;
          continue;
        }
        if (exportPath && !prisma) {
          // solo export/share, sin DB
          continue;
        }
        if (!prisma) continue;
        const op = await upsertOverride(prisma, c, false);
        if (op === "create") stats.create++;
        else stats.update++;
        log(
          op,
          c.category,
          `tmdb-${c.tmdbId}`,
          c.season != null
            ? `S${String(c.season).padStart(2, "0")}E${String(c.episode).padStart(2, "0")}`
            : "movie",
          c.title
        );
      } catch (e) {
        stats.errors++;
        log("ERROR", c.drivePath, String(e));
      }
    }
  } finally {
    if (prisma) await prisma.$disconnect();
  }

  log("listo", stats);
  if (dryRun) {
    log("Era dry-run: no se escribió en la DB ni se compartió.");
    log("Siguiente (DB interna Coolify):");
    log('  npm run mirror:register -- --share --export data/drive-overrides.json');
    log("  Luego importá ese JSON desde el contenedor app o con DATABASE_URL pública.");
  }
  if (!doShare && !dryRun && !exportPath) {
    log(
      "Tip: usá --share para publicar “cualquiera con el enlace” (necesario para GOOGLE_DRIVE_API_KEY en Coolify)."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
