/**
 * Diagnóstico de fuentes de catálogo.
 *   npm run sources:check
 *
 * Consulta cada fuente por separado y reporta cuántos títulos aporta y cuánto
 * tarda. Útil para saber si una fuente está caída, si falta una credencial o
 * si CATALOG_SOURCES la tiene apagada.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Carga .env.local y .env sin depender de dotenv. */
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

type Check = {
  name: string;
  run: () => Promise<{ count: number; sample?: string }>;
};

async function main() {
  const { getVimeusMovies, getVimeusSeries, getVimeusAnimes } = await import(
    "../lib/vimeus"
  );
  const { getTmdbMovieRows, getTmdbSeriesRows, getTmdbAnimeRows } = await import(
    "../lib/sources/tmdbSource"
  );
  const { getJikanAnimeRows } = await import("../lib/sources/jikan");
  const { getPlutoMovies, getPlutoSeries } = await import(
    "../lib/sources/plutoSource"
  );
  const { getArchiveRows } = await import("../lib/sources/archive");
  const { enabledSources, SOURCE_LABELS } = await import("../lib/sources/types");

  const active = enabledSources();
  console.log(
    `Fuentes activas: ${
      active.length ? active.map((id) => SOURCE_LABELS[id]).join(", ") : "ninguna"
    }`
  );
  console.log(
    `CATALOG_SOURCES=${process.env.CATALOG_SOURCES || "(sin definir → todas)"}\n`
  );

  const flat = (rows: { items: unknown[] }[]) =>
    rows.reduce((total, row) => total + row.items.length, 0);

  const first = (items: { title?: string; name?: string }[]) =>
    items[0] ? (items[0].title || items[0].name || undefined) : undefined;

  const checks: Check[] = [
    {
      name: "Vimeus · películas",
      run: async () => {
        const items = await getVimeusMovies([1]);
        return { count: items.length, sample: first(items) };
      },
    },
    {
      name: "Vimeus · series",
      run: async () => {
        const items = await getVimeusSeries([1]);
        return { count: items.length, sample: first(items) };
      },
    },
    {
      name: "Vimeus · animes",
      run: async () => {
        const items = await getVimeusAnimes([1]);
        return { count: items.length, sample: first(items) };
      },
    },
    {
      name: "TMDB · películas",
      run: async () => {
        const rows = await getTmdbMovieRows([1]);
        return { count: flat(rows), sample: first(rows[0]?.items ?? []) };
      },
    },
    {
      name: "TMDB · series",
      run: async () => {
        const rows = await getTmdbSeriesRows([1]);
        return { count: flat(rows), sample: first(rows[0]?.items ?? []) };
      },
    },
    {
      name: "TMDB · anime",
      run: async () => {
        const rows = await getTmdbAnimeRows([1]);
        return { count: flat(rows), sample: first(rows[0]?.items ?? []) };
      },
    },
    {
      name: "MyAnimeList (Jikan)",
      run: async () => {
        const rows = await getJikanAnimeRows();
        return { count: flat(rows), sample: first(rows[0]?.items ?? []) };
      },
    },
    {
      name: "Pluto TV · películas",
      run: async () => {
        const items = await getPlutoMovies();
        return { count: items.length, sample: first(items) };
      },
    },
    {
      name: "Pluto TV · series",
      run: async () => {
        const items = await getPlutoSeries();
        return { count: items.length, sample: first(items) };
      },
    },
    {
      name: "Archive.org",
      run: async () => {
        const rows = await getArchiveRows();
        return { count: flat(rows), sample: first(rows[0]?.items ?? []) };
      },
    },
  ];

  let failures = 0;

  for (const check of checks) {
    const started = Date.now();
    try {
      const { count, sample } = await check.run();
      const ms = Date.now() - started;
      const status = count > 0 ? "OK  " : "VACÍO";
      if (count === 0) failures++;
      console.log(
        `${status} ${check.name.padEnd(22)} ${String(count).padStart(4)} títulos  ${String(ms).padStart(6)} ms${
          sample ? `  · ej. ${sample}` : ""
        }`
      );
    } catch (err) {
      failures++;
      const ms = Date.now() - started;
      console.log(
        `FALLA ${check.name.padEnd(22)}    -  títulos  ${String(ms).padStart(6)} ms  · ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  console.log(
    failures
      ? `\n${failures} comprobación(es) sin resultados. Revisa credenciales o CATALOG_SOURCES.`
      : "\nTodas las fuentes respondieron."
  );

  // Catálogo ya agregado, tal como lo verá la portada.
  const { getHomeCatalog } = await import("../lib/catalog");
  const started = Date.now();
  const home = await getHomeCatalog();
  const items = home.rows.flatMap((row) => row.items);
  const playable = items.filter((item) => item.playable).length;

  console.log(`\nPortada agregada en ${Date.now() - started} ms`);
  console.log(
    `  ${home.rows.length} filas · ${items.length} títulos · ${playable} reproducibles · ${
      items.length - playable
    } solo ficha`
  );
  console.log(`  Destacado: ${home.featured[0] ? first(home.featured) : "ninguno"}`);
  for (const row of home.rows) {
    const rowPlayable = row.items.filter((item) => item.playable).length;
    console.log(
      `  · ${row.title.padEnd(38)} ${String(row.items.length).padStart(3)} títulos (${rowPlayable} con stream)`
    );
  }
}

void main();
