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
import { getAnimeAv1Rows, getAnimeAv1Items, getAnimeAv1HomeItems } from "@/lib/sources/animeav1";
import { getMangaEsItems, getMangaEsRows } from "@/lib/sources/manga";
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
const MANGA_TIMEOUT_MS = 45000;

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

async function loadAnimeAv1Rows(): Promise<LoadedRow[]> {
  if (!enabledSources().includes("animeav1")) return [];
  return withTimeout(getAnimeAv1Rows(), SLOW_TIMEOUT_MS, [], "animeav1:rows");
}

async function loadAnimeAv1Items(): Promise<CatalogItem[]> {
  if (!enabledSources().includes("animeav1")) return [];
  return withTimeout(getAnimeAv1Items(), SLOW_TIMEOUT_MS, [], "animeav1:items");
}

async function loadAnimeAv1HomeItems(): Promise<CatalogItem[]> {
  if (!enabledSources().includes("animeav1")) return [];
  return withTimeout(
    getAnimeAv1HomeItems(24),
    FAST_TIMEOUT_MS,
    [],
    "animeav1:home"
  );
}

async function loadMangaEsItems() {
  if (
    !enabledSources().includes("yupmanga") &&
    !enabledSources().includes("mangadex")
  ) {
    return [];
  }
  return withTimeout(getMangaEsItems(), MANGA_TIMEOUT_MS, [], "manga:items");
}

async function loadMangaEsRows(): Promise<LoadedRow[]> {
  if (
    !enabledSources().includes("yupmanga") &&
    !enabledSources().includes("mangadex")
  ) {
    return [];
  }
  return withTimeout(getMangaEsRows(), MANGA_TIMEOUT_MS, [], "manga:rows");
}

export async function getMangaCatalog(): Promise<CatalogPage> {
  const mangaRows = await loadMangaEsRows();
  const src: SourceId = enabledSources().includes("yupmanga")
    ? "yupmanga"
    : "mangadex";
  return {
    featured: mangaRows[0]?.items?.slice(0, 8) || [],
    rows: finishRows(mangaRows),
    activeSources: mangaRows.length ? ([src] as SourceId[]) : [],
  };
}

export async function getAnimeCatalog(): Promise<CatalogPage> {
  const [av1Rows, tmdbRows, jikanRows] = await Promise.all([
    loadAnimeAv1Rows(),
    loadTmdbRows("anime", [1, 2]),
    loadJikanRows(),
  ]);

  const playableRows: LoadedRow[] = av1Rows.length
    ? av1Rows
    : // fallback si AnimeAV1 falla: Vimeus
      vimeusRows([
        {
          title: "Recién añadidos",
          items: await loadVimeus("animes", [1]),
          mediaType: "tv",
        },
      ]);

  const available = buildAvailabilityIndex(
    await loadAvailability(),
    playableRows
  );
  const discoveryRows = applyAvailability(
    [...jikanRows, ...tmdbRows],
    available
  );
  const allRows = [...playableRows, ...discoveryRows];

  return {
    featured: await pickFeatured(playableRows.length ? playableRows : allRows),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}

/**
 * Home: prioriza populares, más vistas y estrenos; luego reproducibles ligeros.
 * Evita Pluto/Archive/AnimeAV1 completo (eran la mayor causa de lentitud/RAM).
 */
async function buildHomeCatalog(): Promise<CatalogPage> {
  const [
    vimeusMovies,
    vimeusSeries,
    animeAv1Items,
    mangaEsItems,
    tmdbMovieRows,
    tmdbSeriesRows,
    tmdbAnimeRows,
    mostViewedRow,
  ] = await Promise.all([
    loadVimeus("movies", [1]),
    loadVimeus("series", [1]),
    loadAnimeAv1HomeItems(),
    loadMangaEsItems(),
    loadTmdbRows("movies", [1]),
    loadTmdbRows("series", [1]),
    loadTmdbRows("anime", [1]),
    loadMostViewedRow(),
  ]);

  const playableRows: LoadedRow[] = [
    ...vimeusRows([
      { title: "Películas para ver ya", items: vimeusMovies, mediaType: "movie" },
      { title: "Series para ver ya", items: vimeusSeries, mediaType: "tv" },
    ]),
    {
      title: "Animes para ver ya",
      mediaType: "tv",
      items: animeAv1Items,
    },
    {
      title: "Mangas en español",
      mediaType: "tv",
      items: mangaEsItems,
    },
  ];

  const available = buildAvailabilityIndex(await loadAvailability(), playableRows);

  const highlightDiscovery = applyAvailability(
    [
      ...tmdbMovieRows.slice(0, 5),
      ...tmdbSeriesRows.slice(0, 4),
      ...tmdbAnimeRows.slice(0, 2),
    ],
    available
  );

  const mostViewed = mostViewedRow
    ? applyAvailability([mostViewedRow], available)
    : [];

  const allRows = [...mostViewed, ...highlightDiscovery, ...playableRows];

  return {
    featured: await pickFeatured(
      highlightDiscovery.length
        ? highlightDiscovery
        : playableRows.length
          ? playableRows
          : allRows
    ),
    rows: finishRows(allRows),
    activeSources: collectSources(allRows),
  };
}

/** Caché 3 min: el home no debe martillar AnimeAV1/TMDB/Vimeus en cada visita. */
export async function getHomeCatalog(): Promise<CatalogPage> {
  const { unstable_cache } = await import("next/cache");
  const cached = unstable_cache(buildHomeCatalog, ["veotv-home-catalog-v3"], {
    revalidate: 180,
    tags: ["home-catalog"],
  });
  return cached();
}

/** Agrega lo más visto en VeoTV a partir del historial global. */
async function loadMostViewedRow(): Promise<LoadedRow | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const grouped = await prisma.watchProgress.groupBy({
      by: ["mediaType", "tmdbId"],
      _count: { _all: true },
      _max: { title: true, posterPath: true },
    });

    if (!grouped.length) return null;

    const ranked = [...grouped]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 28);

    const items: CatalogItem[] = ranked.map((row) => {
      const mediaType = (row.mediaType === "tv" ? "tv" : "movie") as MediaType;
      return {
        id: row.tmdbId,
        title: row._max.title || "Sin título",
        name: row._max.title || "Sin título",
        overview: "",
        poster_path: row._max.posterPath || null,
        backdrop_path: null,
        media_type: mediaType,
        vote_average: Math.min(10, 5 + row._count._all * 0.4),
        sources: ["tmdb"] as SourceId[],
        playable: false,
      };
    });

    return {
      title: "Más vistas en VeoTV",
      mediaType: "movie",
      items,
    };
  } catch (err) {
    console.error("[catalog] más vistas", err);
    return null;
  }
}

function posterUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w342${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Top posters reproducibles del catálogo (películas + series), para login/landing.
 * Se refresca cada hora vía caché de Next.
 */
export async function getPopularCatalogPosters(limit = 16): Promise<string[]> {
  const { unstable_cache } = await import("next/cache");

  const load = unstable_cache(
    async () => {
      const { featured, rows } = await getHomeCatalog();
      const byId = new Map<string, CatalogItem>();

      for (const item of featured) {
        const key = `${item.media_type ?? "movie"}-${item.id}`;
        if (!byId.has(key)) byId.set(key, item);
      }
      for (const row of rows) {
        for (const item of row.items) {
          const key = `${item.media_type ?? row.mediaType ?? "movie"}-${item.id}`;
          if (!byId.has(key)) byId.set(key, item);
        }
      }

      const ranked = [...byId.values()]
        .filter((item) => item.playable && item.poster_path)
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

      const movies = ranked.filter((i) => (i.media_type ?? "movie") === "movie");
      const series = ranked.filter((i) => i.media_type === "tv");
      const mixed: CatalogItem[] = [];
      const max = Math.max(movies.length, series.length);
      for (let i = 0; i < max && mixed.length < limit; i++) {
        if (movies[i]) mixed.push(movies[i]);
        if (series[i] && mixed.length < limit) mixed.push(series[i]);
      }

      const urls = mixed
        .map((item) => posterUrl(item.poster_path!))
        .filter(Boolean);

      if (urls.length < 8) {
        for (const item of ranked.length ? ranked : featured) {
          if (!item.poster_path) continue;
          const url = posterUrl(item.poster_path);
          if (!urls.includes(url)) urls.push(url);
          if (urls.length >= limit) break;
        }
      }

      return urls.slice(0, limit);
    },
    ["popular-catalog-posters", String(limit)],
    { revalidate: 3600 }
  );

  return load();
}
