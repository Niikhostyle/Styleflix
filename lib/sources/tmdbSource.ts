/**
 * TMDB como fuente de catálogo (no solo de metadatos).
 * Aporta muchísimo más volumen que el listing de Vimeus; la disponibilidad de
 * stream se resuelve después contra el índice de fuentes reproducibles.
 */

import { tmdbList, type MediaItem, type MediaType } from "@/lib/tmdb";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

type RowDef = {
  title: string;
  endpoint: string;
  mediaType: MediaType;
};

const MOVIE_ROWS: RowDef[] = [
  { title: "Tendencias en películas", endpoint: "/trending/movie/week", mediaType: "movie" },
  { title: "Películas populares", endpoint: "/movie/popular", mediaType: "movie" },
  { title: "Estrenos en cartelera", endpoint: "/movie/now_playing", mediaType: "movie" },
  { title: "Próximos estrenos", endpoint: "/movie/upcoming", mediaType: "movie" },
  { title: "Mejor valoradas", endpoint: "/movie/top_rated", mediaType: "movie" },
  { title: "Acción", endpoint: "/discover/movie?with_genres=28", mediaType: "movie" },
  { title: "Comedia", endpoint: "/discover/movie?with_genres=35", mediaType: "movie" },
  { title: "Terror", endpoint: "/discover/movie?with_genres=27", mediaType: "movie" },
  { title: "Drama", endpoint: "/discover/movie?with_genres=18", mediaType: "movie" },
  { title: "Ciencia ficción", endpoint: "/discover/movie?with_genres=878", mediaType: "movie" },
  { title: "Animación", endpoint: "/discover/movie?with_genres=16", mediaType: "movie" },
  { title: "Documentales", endpoint: "/discover/movie?with_genres=99", mediaType: "movie" },
];

const SERIES_ROWS: RowDef[] = [
  { title: "Tendencias en series", endpoint: "/trending/tv/week", mediaType: "tv" },
  { title: "Series populares", endpoint: "/tv/popular", mediaType: "tv" },
  { title: "Estrenos en TV", endpoint: "/tv/on_the_air", mediaType: "tv" },
  { title: "Se emiten hoy", endpoint: "/tv/airing_today", mediaType: "tv" },
  { title: "Series mejor valoradas", endpoint: "/tv/top_rated", mediaType: "tv" },
  { title: "Drama", endpoint: "/discover/tv?with_genres=18", mediaType: "tv" },
  { title: "Crimen", endpoint: "/discover/tv?with_genres=80", mediaType: "tv" },
  { title: "Ciencia ficción y fantasía", endpoint: "/discover/tv?with_genres=10765", mediaType: "tv" },
  { title: "Comedia", endpoint: "/discover/tv?with_genres=35", mediaType: "tv" },
  { title: "Reality y talk shows", endpoint: "/discover/tv?with_genres=10764", mediaType: "tv" },
];

const ANIME_ROWS: RowDef[] = [
  {
    title: "Anime popular",
    endpoint:
      "/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc",
    mediaType: "tv",
  },
  {
    title: "Anime mejor valorado",
    endpoint:
      "/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=200",
    mediaType: "tv",
  },
  {
    title: "Anime reciente",
    endpoint:
      "/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&first_air_date.gte=2023-01-01",
    mediaType: "tv",
  },
  {
    title: "Anime de acción",
    endpoint:
      "/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=popularity.desc",
    mediaType: "tv",
  },
  {
    title: "Películas de anime",
    endpoint:
      "/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc",
    mediaType: "movie",
  },
];

async function loadRow(
  row: RowDef,
  pages: number[]
): Promise<{ title: string; mediaType: MediaType; items: CatalogItem[] }> {
  try {
    const items = await tmdbList(row.endpoint, row.mediaType, {
      pages,
      limit: pages.length * 20,
    });
    return {
      title: row.title,
      mediaType: row.mediaType,
      items: items.map((item: MediaItem) => toCatalogItem(item, "tmdb", false)),
    };
  } catch (err) {
    console.error(`[tmdb-source] fila "${row.title}" falló`, err);
    return { title: row.title, mediaType: row.mediaType, items: [] };
  }
}

function loadRows(rows: RowDef[], pages: number[]) {
  return Promise.all(rows.map((row) => loadRow(row, pages)));
}

export function getTmdbMovieRows(pages: number[] = [1, 2]) {
  return loadRows(MOVIE_ROWS, pages);
}

export function getTmdbSeriesRows(pages: number[] = [1, 2]) {
  return loadRows(SERIES_ROWS, pages);
}

export function getTmdbAnimeRows(pages: number[] = [1, 2]) {
  return loadRows(ANIME_ROWS, pages);
}
