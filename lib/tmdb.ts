const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

/** Posters nítidos en pantallas Retina y tarjetas ampliadas. */
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
/** Alias explícito para posters. */
export const IMAGE_POSTER_URL = "https://image.tmdb.org/t/p/w500";
/** Backdrop hero / detalle en alta resolución. */
export const IMAGE_BACKDROP_URL = "https://image.tmdb.org/t/p/original";
/** Solo cuando hace falta máxima calidad (p.ej. player cover). */
export const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

/** Ítems por fila en home/catálogo (~2 páginas TMDB). */
const LIST_PAGES = 2;
const LIST_LIMIT = 40;

export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type?: MediaType;
  genre_ids?: number[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TrailerVideo {
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
  iso_639_1?: string;
}

export interface MediaDetails extends MediaItem {
  genres: Genre[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  adult?: boolean;
  original_language?: string;
  seasons?: SeasonSummary[];
  credits?: {
    cast: CastMember[];
  };
  videos?: {
    results: TrailerVideo[];
  };
}

export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  air_date?: string | null;
}

export interface EpisodeInfo {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  runtime?: number | null;
  air_date?: string | null;
}

interface TMDBListResponse {
  results: MediaItem[];
}

function buildUrl(endpoint: string, extraParams = "") {
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${BASE_URL}${endpoint}${separator}api_key=${API_KEY}&language=es-ES${extraParams}`;
}

function assertApiKey() {
  if (!API_KEY) {
    throw new Error(
      "Falta NEXT_PUBLIC_TMDB_API_KEY. Configúrala en Vercel → Settings → Environment Variables."
    );
  }
}

async function fetchList(
  endpoint: string,
  mediaType?: MediaType
): Promise<MediaItem[]> {
  assertApiKey();

  const pages = await Promise.all(
    Array.from({ length: LIST_PAGES }, (_, i) => i + 1).map(async (page) => {
      const res = await fetch(buildUrl(endpoint, `&page=${page}`), {
        next: { revalidate: 7200, tags: ["tmdb", `tmdb-list`] },
      });
      if (!res.ok) {
        throw new Error(`Error al consultar TMDB: ${res.status}`);
      }
      const data: TMDBListResponse = await res.json();
      return data.results ?? [];
    })
  );

  const seen = new Set<number>();
  const merged: MediaItem[] = [];
  for (const item of pages.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push({
      ...item,
      media_type: item.media_type ?? mediaType,
    });
    if (merged.length >= LIST_LIMIT) break;
  }
  return merged;
}

async function fetchDetails(
  type: MediaType,
  id: number
): Promise<MediaDetails> {
  assertApiKey();
  const res = await fetch(
    buildUrl(
      `/${type}/${id}`,
      "&append_to_response=credits,videos&include_video_language=es-ES,en-US,en,null"
    ),
    { next: { revalidate: 7200, tags: ["tmdb", `tmdb-${type}-${id}`] } }
  );

  if (!res.ok) {
    throw new Error(`No se encontró el título (${res.status})`);
  }

  const data: MediaDetails = await res.json();
  return { ...data, media_type: type };
}

/** Mejor tráiler de YouTube (Trailer/Teaser oficial, prioriza español). */
export function getBestTrailerKey(details: MediaDetails): string | null {
  const results = details.videos?.results ?? [];
  const yt = results.filter((v) => v.site === "YouTube" && v.key);

  if (!yt.length) return null;

  const score = (v: TrailerVideo) => {
    let s = 0;
    if (v.type === "Trailer") s += 40;
    else if (v.type === "Teaser") s += 25;
    else if (v.type === "Clip") s += 10;
    if (v.official) s += 15;
    if (v.iso_639_1 === "es") s += 20;
    else if (v.iso_639_1 === "en") s += 8;
    const name = (v.name || "").toLowerCase();
    if (name.includes("oficial") || name.includes("official")) s += 5;
    return s;
  };

  return [...yt].sort((a, b) => score(b) - score(a))[0]?.key ?? null;
}

export function getYoutubeEmbedUrl(videoKey: string, muted: boolean) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    disablekb: "1",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    loop: "1",
    playlist: videoKey,
    enablejsapi: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    fs: "0",
    // Oculta sugerencias / UI extra
    showinfo: "0",
  });
  // nocookie reduce chrome de YouTube; origin ayuda al embed
  return `https://www.youtube-nocookie.com/embed/${videoKey}?${params.toString()}`;
}

export function getDisplayTitle(item: Pick<MediaItem, "title" | "name">) {
  return item.title || item.name || "Sin título";
}

export function getReleaseYear(item: MediaItem) {
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : null;
}

export function formatRuntime(minutes?: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function getMatchPercentage(voteAverage?: number) {
  if (!voteAverage) return null;
  return Math.round(voteAverage * 10);
}

/** Películas */
export function getTrendingMovies() {
  return fetchList("/trending/movie/week", "movie");
}

export function getPopularMovies() {
  return fetchList("/movie/popular", "movie");
}

export function getTopRatedMovies() {
  return fetchList("/movie/top_rated", "movie");
}

export function getNowPlayingMovies() {
  return fetchList("/movie/now_playing", "movie");
}

export function getUpcomingMovies() {
  return fetchList("/movie/upcoming", "movie");
}

export function getActionMovies() {
  return fetchList("/discover/movie?with_genres=28", "movie");
}

export function getComedyMovies() {
  return fetchList("/discover/movie?with_genres=35", "movie");
}

export function getHorrorMovies() {
  return fetchList("/discover/movie?with_genres=27", "movie");
}

export function getDramaMovies() {
  return fetchList("/discover/movie?with_genres=18", "movie");
}

export function getMovieDetails(id: number) {
  return fetchDetails("movie", id);
}

export function getSimilarMovies(id: number) {
  return fetchList(`/movie/${id}/similar`, "movie");
}

/** Series */
export function getTrendingSeries() {
  return fetchList("/trending/tv/week", "tv");
}

export function getPopularSeries() {
  return fetchList("/tv/popular", "tv");
}

export function getTopRatedSeries() {
  return fetchList("/tv/top_rated", "tv");
}

export function getAiringTodaySeries() {
  return fetchList("/tv/airing_today", "tv");
}

export function getDramaSeries() {
  return fetchList("/discover/tv?with_genres=18", "tv");
}

export function getCrimeSeries() {
  return fetchList("/discover/tv?with_genres=80", "tv");
}

export function getSciFiSeries() {
  return fetchList("/discover/tv?with_genres=10765", "tv");
}

export function getTVDetails(id: number) {
  return fetchDetails("tv", id);
}

export function getSimilarSeries(id: number) {
  return fetchList(`/tv/${id}/similar`, "tv");
}

export async function getTVSeason(
  tvId: number,
  seasonNumber: number
): Promise<{ episodes: EpisodeInfo[]; name: string; season_number: number }> {
  const res = await fetch(buildUrl(`/tv/${tvId}/season/${seasonNumber}`), {
    next: {
      revalidate: 7200,
      tags: ["tmdb", `tmdb-tv-${tvId}-s${seasonNumber}`],
    },
  });

  if (!res.ok) {
    throw new Error(`No se pudo cargar la temporada (${res.status})`);
  }

  const data = await res.json();
  return {
    name: data.name ?? `Temporada ${seasonNumber}`,
    season_number: data.season_number ?? seasonNumber,
    episodes: (data.episodes ?? []).map(
      (ep: EpisodeInfo & { still_path?: string | null }) => ({
        id: ep.id,
        name: ep.name,
        overview: ep.overview ?? "",
        episode_number: ep.episode_number,
        season_number: ep.season_number ?? seasonNumber,
        still_path: ep.still_path ?? null,
        runtime: ep.runtime ?? null,
        air_date: ep.air_date ?? null,
      })
    ),
  };
}

/** Anime (animación japonés) */
export function getPopularAnime() {
  return fetchList(
    "/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc",
    "tv"
  );
}

export function getTopRatedAnime() {
  return fetchList(
    "/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=200",
    "tv"
  );
}

export function getTrendingAnime() {
  return fetchList(
    "/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&first_air_date.gte=2023-01-01",
    "tv"
  );
}

export function getAnimeMovies() {
  return fetchList(
    "/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc",
    "movie"
  );
}

export function getActionAnime() {
  return fetchList(
    "/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=popularity.desc",
    "tv"
  );
}

export async function getMediaDetails(type: MediaType, id: number) {
  return type === "movie" ? getMovieDetails(id) : getTVDetails(id);
}

export async function getSimilarMedia(type: MediaType, id: number) {
  return type === "movie" ? getSimilarMovies(id) : getSimilarSeries(id);
}

/** Búsqueda multi (películas + series) */
export async function searchMulti(query: string): Promise<MediaItem[]> {
  const q = query.trim();
  if (!q) return [];
  assertApiKey();

  const res = await fetch(
    buildUrl("/search/multi", `&query=${encodeURIComponent(q)}&include_adult=false`),
    { next: { revalidate: 600 } }
  );

  if (!res.ok) {
    throw new Error(`Error en búsqueda TMDB: ${res.status}`);
  }

  const data: TMDBListResponse = await res.json();
  return (data.results ?? [])
    .filter(
      (item) =>
        item.media_type === "movie" || item.media_type === "tv"
    )
    .map((item) => ({
      ...item,
      media_type: item.media_type as MediaType,
    }));
}

/** @deprecated Usar MediaItem — alias de compatibilidad */
export type Movie = MediaItem;
