/**
 * Agregador de catálogo multi-fuente.
 *
 * Vimeus, Pluto TV y Archive.org aportan títulos que sabemos reproducir.
 * TMDB y MyAnimeList aportan volumen de descubrimiento; sus títulos se cruzan
 * contra el índice de fuentes reproducibles para marcar cuáles tienen stream.
 *
 * Cada fuente se puede apagar con la variable CATALOG_SOURCES.
 */

import { enrichWithTmdb, getVimeusAvailability, getVimeusAnimes, getVimeusMovies, getVimeusSeries } from "@/lib/vimeus";
import { getTmdbAnimeRows, getTmdbMovieRows, getTmdbSeriesRows } from "@/lib/sources/tmdbSource";
import { getJikanAnimeRows } from "@/lib/sources/jikan";
import { getPlutoMovies, getPlutoSeries } from "@/lib/sources/plutoSource";
import { getArchiveRows } from "@/lib/sources/archive";
import { withTimeout } from "@/lib/sources/match";
import {
  enabledSources,
  mergeCatalogItems,
  playableFirst,
  toCatalogItem,
  type CatalogItem,
  type CatalogRow,
  type SourceId,
} from "@/lib/sources/types";
import type { MediaItem, MediaType } from "@/lib/tmdb";

/** Las fuentes de descubrimiento son rápidas; las que mapean títulos, no. */
const FAST_TIMEOUT_MS = 8000;
const SLOW_TIMEOUT_MS = 15000;

export type CatalogPage = {
  featured: CatalogItem[];
  rows: CatalogRow[];
  /** Fuentes que realmente aportaron títulos, para mostrarlo en la UI. */
  activeSources: SourceId[];
};

type LoadedRow = { title: string; mediaType: MediaType; items: CatalogItem[] };

function vimeusRows(
  lists: { title: string; items: MediaItem[]; mediaType: MediaType }[]
): LoadedRow[] {
  return lists.map((row) => ({
    title: row.title,
    mediaType: row.mediaType,
    items: row.items.map((item) => toCatalogItem(item, "vimeus", true)),
  }));
}

/**
 * Marca como reproducibles los títulos de fuentes de descubrimiento que
 * aparecen en el índice de disponibilidad.
 */
function applyAvailability(rows: LoadedRow[], available: Set<number>): LoadedRow[] {
  return rows.map((row) => ({
    ...row,
    items: row.items.map((item) =>
      item.playable || !available.has(item.id)
        ? item
        : { ...item, playable: true }
    ),
  }));
}

function buildAvailabilityIndex(
  vimeusIds: Set<number>,
  playableRows: LoadedRow[]
): Set<number> {
  const index = new Set(vimeusIds);
  for (const row of playableRows) {
    for (const item of row.items) index.add(item.id);
  }
  return index;
}

function finishRows(rows: LoadedRow[], limit = 40): CatalogRow[] {
  return rows
    .filter((row) => row.items.length > 0)
    .map((row) => ({
      title: row.title,
      mediaType: row.mediaType,
      items: playableFirst(
        mergeCatalogItems([row.items], {
          fallbackType: row.mediaType,
          limit,
        })
      ),
    }));
}

function collectSources(rows: LoadedRow[]): SourceId[] {
  const ids = new Set<SourceId>();
  for (const row of rows) {
    for (const item of row.items) {
      for (const source of item.sources ?? []) ids.add(source);
    }
  }
  return [...ids];
}

/** Mejor candidato para el hero: reproducible, con imagen y bien valorado. */
async function pickFeatured(rows: LoadedRow[]): Promise<CatalogItem[]> {
  const pool = mergeCatalogItems(
    rows.map((row) => row.items),
    { limit: 60 }
  );

  const ranked = pool
    .filter((item) => item.backdrop_path || item.poster_path)
    .sort((a, b) => {
      const playable =
        Number(Boolean(b.playable)) - Number(Boolean(a.playable));
      if (playable !== 0) return playable;
      const backdrop =
        Number(Boolean(b.backdrop_path)) - Number(Boolean(a.backdrop_path));
      if (backdrop !== 0) return backdrop;
      return (b.vote_average ?? 0) - (a.vote_average ?? 0);
    });

  if (!ranked.length) return [];

  const [first, ...rest] = ranked;
  const enriched = await enrichWithTmdb(first).catch(() => first);
  return [{ ...first, ...enriched, sources: first.sources, playable: first.playable }, ...rest];
}

async function loadVimeus(
  kind: "movies" | "series" | "animes",
  pages: number[]
): Promise<MediaItem[]> {
  if (!enabledSources().includes("vimeus")) return [];
  const loader =
    kind === "movies"
      ? getVimeusMovies
      : kind === "series"
        ? getVimeusSeries
        : getVimeusAnimes;
  return withTimeout(loader(pages), FAST_TIMEOUT_MS, [], `vimeus:${kind}`);
}

async function loadAvailability(): Promise<Set<number>> {
  if (!enabledSources().includes("vimeus")) return new Set();
  return withTimeout(
    getVimeusAvailability([1, 2, 3, 4, 5]),
    FAST_TIMEOUT_MS,
    new Set<number>(),
    "vimeus:availability"
  );
}

async function loadTmdbRows(
  kind: "movies" | "series" | "anime",
  pages: number[]
): Promise<LoadedRow[]> {
  if (!enabledSources().includes("tmdb")) return [];
  const loader =
    kind === "movies"
      ? getTmdbMovieRows
      : kind === "series"
        ? getTmdbSeriesRows
        : getTmdbAnimeRows;
  return withTimeout(loader(pages), FAST_TIMEOUT_MS, [], `tmdb:${kind}`);
}

async function loadJikanRows(): Promise<LoadedRow[]> {
  if (!enabledSources().includes("jikan")) return [];
  return withTimeout(getJikanAnimeRows(), SLOW_TIMEOUT_MS, [], "jikan");
}

async function loadPluto(kind: "movies" | "series"): Promise<CatalogItem[]> {
  if (!enabledSources().includes("pluto")) return [];
  const loader = kind === "movies" ? getPlutoMovies : getPlutoSeries;
  return withTimeout(loader(), SLOW_TIMEOUT_MS, [], `pluto:${kind}`);
}

async function loadArchiveRows(): Promise<LoadedRow[]> {
  if (!enabledSources().includes("archive")) return [];
  return withTimeout(getArchiveRows(), SLOW_TIMEOUT_MS, [], "archive");
}

export async function getMoviesCatalog(): Promise<CatalogPage> {
  const [vimeus1, vimeus2, vimeus3, tmdbRows, plutoMovies, archiveRows] =
    await Promise.all([
      loadVimeus("movies", [1]),
      loadVimeus("movies", [2]),
      loadVimeus("movies", [3]),
      loadTmdbRows("movies", [1, 2]),
      loadPluto("movies"),
      loadArchiveRows(),
    ]);

  const playableRows: LoadedRow[] = [
    ...vimeusRows([
      { title: "Recién añadidas", items: vimeus1, mediaType: "movie" },
      { title: "Más películas", items: vimeus2, mediaType: "movie" },
      { title: "Seguir explorando", items: vimeus3, mediaType: "movie" },
    ]),
    { title: "Películas destacadas", mediaType: "movie", items: plutoMovies },
    ...archiveRows,
  ];

  const available = buildAvailabilityIndex(await loadAvailability(), playableRows);
  const discoveryRows = applyAvailability(tmdbRows, available);
  const allRows = [...playableRows, ...discoveryRows];

  return {
    featured: await pickFeatured(playableRows.length ? playableRows : allRows),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}

export async function getSeriesCatalog(): Promise<CatalogPage> {
  const [vimeus1, vimeus2, vimeus3, tmdbRows, plutoSeries] = await Promise.all([
    loadVimeus("series", [1]),
    loadVimeus("series", [2]),
    loadVimeus("series", [3]),
    loadTmdbRows("series", [1, 2]),
    loadPluto("series"),
  ]);

  const playableRows: LoadedRow[] = [
    ...vimeusRows([
      { title: "Recién añadidas", items: vimeus1, mediaType: "tv" },
      { title: "Más series", items: vimeus2, mediaType: "tv" },
      { title: "Seguir explorando", items: vimeus3, mediaType: "tv" },
    ]),
    { title: "Series destacadas", mediaType: "tv", items: plutoSeries },
  ];

  const available = buildAvailabilityIndex(await loadAvailability(), playableRows);
  const discoveryRows = applyAvailability(tmdbRows, available);
  const allRows = [...playableRows, ...discoveryRows];

  return {
    featured: await pickFeatured(playableRows.length ? playableRows : allRows),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}

export async function getAnimeCatalog(): Promise<CatalogPage> {
  const [vimeus1, vimeus2, vimeus3, tmdbRows, jikanRows] = await Promise.all([
    loadVimeus("animes", [1]),
    loadVimeus("animes", [2]),
    loadVimeus("animes", [3]),
    loadTmdbRows("anime", [1, 2]),
    loadJikanRows(),
  ]);

  const playableRows: LoadedRow[] = vimeusRows([
    { title: "Recién añadidos", items: vimeus1, mediaType: "tv" },
    { title: "Más animes", items: vimeus2, mediaType: "tv" },
    { title: "Seguir explorando", items: vimeus3, mediaType: "tv" },
  ]);

  const available = buildAvailabilityIndex(await loadAvailability(), playableRows);
  const discoveryRows = applyAvailability([...jikanRows, ...tmdbRows], available);
  const allRows = [...playableRows, ...discoveryRows];

  return {
    featured: await pickFeatured(playableRows.length ? playableRows : allRows),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}

/**
 * Home: una selección de cada fuente en lugar del catálogo completo, para no
 * pagar el costo de todas las filas en la portada.
 */
export async function getHomeCatalog(): Promise<CatalogPage> {
  const [
    vimeusMovies,
    vimeusSeries,
    vimeusAnimes,
    tmdbMovieRows,
    tmdbSeriesRows,
    tmdbAnimeRows,
    plutoMovies,
    plutoSeries,
    archiveRows,
    jikanRows,
  ] = await Promise.all([
    loadVimeus("movies", [1, 2]),
    loadVimeus("series", [1, 2]),
    loadVimeus("animes", [1]),
    loadTmdbRows("movies", [1]),
    loadTmdbRows("series", [1]),
    loadTmdbRows("anime", [1]),
    loadPluto("movies"),
    loadPluto("series"),
    loadArchiveRows(),
    loadJikanRows(),
  ]);

  const playableRows: LoadedRow[] = [
    ...vimeusRows([
      { title: "Películas para ver ya", items: vimeusMovies, mediaType: "movie" },
      { title: "Series para ver ya", items: vimeusSeries, mediaType: "tv" },
      { title: "Animes para ver ya", items: vimeusAnimes, mediaType: "tv" },
    ]),
    { title: "Películas destacadas", mediaType: "movie", items: plutoMovies },
    { title: "Series destacadas", mediaType: "tv", items: plutoSeries },
    ...archiveRows.slice(0, 2),
  ];

  const available = buildAvailabilityIndex(await loadAvailability(), playableRows);

  const discoveryRows = applyAvailability(
    [
      ...tmdbMovieRows.slice(0, 4),
      ...tmdbSeriesRows.slice(0, 3),
      ...jikanRows.slice(0, 2),
      ...tmdbAnimeRows.slice(0, 2),
    ],
    available
  );

  const allRows = [...playableRows, ...discoveryRows];

  return {
    featured: await pickFeatured(playableRows.length ? playableRows : allRows),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}
