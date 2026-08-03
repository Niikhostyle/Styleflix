import type { MediaItem, MediaType } from "@/lib/tmdb";
import { getMediaDetails } from "@/lib/tmdb";

const BASE = "https://vimeus.com";

export type VimeusKind = "movies" | "series" | "animes" | "episodes";

type VimeusListItem = {
  id?: number;
  content_type?: string;
  tmdb_id?: number | null;
  imdb_id?: string | null;
  title?: string;
  poster?: string | null;
  backdrop?: string | null;
  total_seasons?: number;
  total_episodes?: number;
  season?: number;
  episode?: number;
  synced_at?: string;
  embed_url?: string;
};

/** Personalización del player (theme, splash, UI) — misma config que el dashboard Vimeus. */
const PLAYER_PARAMS: Record<string, string> = {
  title: "StyleFli",
  theme: "minimal",
  loader: "v3",
  font: "v2",
  overlay: "v5",
  selector: "v2",
  playUI: "v2",
  epanel: "v2",
  splash: "v3",
};

/**
 * URL de embed Web (view_key). Docs Vimeus: referrerpolicy=origin en el iframe.
 */
export function getVimeusEmbedUrl(
  mediaType: MediaType,
  tmdbId: number,
  opts?: { season?: number; episode?: number; anime?: boolean }
): string {
  const viewKey = process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY;
  if (!viewKey) {
    throw new Error("Falta NEXT_PUBLIC_VIMEUS_VIEW_KEY");
  }

  const params = new URLSearchParams({
    tmdb: String(tmdbId),
    view_key: viewKey,
    ...PLAYER_PARAMS,
  });

  if (opts?.season != null) params.set("se", String(opts.season));
  if (opts?.episode != null) params.set("ep", String(opts.episode));

  let path: string;
  if (opts?.anime) {
    path = "/e/anime";
  } else if (mediaType === "tv") {
    path = "/e/serie";
  } else {
    path = "/e/movie";
  }

  return `${BASE}${path}?${params.toString()}`;
}

function posterPath(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http")) {
    const m = raw.match(/\/t\/p\/[^/]+(\/.+)$/);
    return m ? m[1] : null;
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function toMediaItem(
  item: VimeusListItem,
  mediaType: MediaType
): MediaItem | null {
  const tmdbId = Number(item.tmdb_id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  return {
    id: tmdbId,
    title: mediaType === "movie" ? item.title : undefined,
    name: mediaType === "tv" ? item.title : undefined,
    overview: "",
    poster_path: posterPath(item.poster),
    backdrop_path: posterPath(item.backdrop),
    media_type: mediaType,
  };
}

function extractItems(payload: unknown, kind: VimeusKind): VimeusListItem[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  const key =
    kind === "movies"
      ? "movies"
      : kind === "series"
        ? "series"
        : kind === "animes"
          ? "animes"
          : "episodes";

  const list = data[key] ?? data.result ?? data.items ?? root[key];
  return Array.isArray(list) ? (list as VimeusListItem[]) : [];
}

/** Listados del servidor (requiere VIMEUS_API_KEY). */
export async function vimeusList(
  kind: VimeusKind,
  page = 1,
  extra?: { tmdb_id?: number; season?: number }
) {
  const apiKey = process.env.VIMEUS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta VIMEUS_API_KEY");
  }

  const params = new URLSearchParams({ page: String(page) });
  if (extra?.tmdb_id != null) params.set("tmdb_id", String(extra.tmdb_id));
  if (extra?.season != null) params.set("season", String(extra.season));

  const res = await fetch(`${BASE}/api/listing/${kind}?${params}`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Vimeus listing error: ${res.status}`);
  }

  return res.json();
}

async function listAsMedia(
  kind: "movies" | "series" | "animes",
  pages: number[],
  mediaType: MediaType
): Promise<MediaItem[]> {
  try {
    const payloads = await Promise.all(pages.map((p) => vimeusList(kind, p)));
    const seen = new Set<number>();
    const out: MediaItem[] = [];

    for (const payload of payloads) {
      for (const raw of extractItems(payload, kind)) {
        const item = toMediaItem(raw, mediaType);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  } catch (err) {
    console.error(`[vimeus] list ${kind} failed`, err);
    return [];
  }
}

/** Catálogo real disponible en Vimeus (evita títulos TMDB sin stream). */
export function getVimeusMovies(pages: number[] = [1, 2]) {
  return listAsMedia("movies", pages, "movie");
}

export function getVimeusSeries(pages: number[] = [1, 2]) {
  return listAsMedia("series", pages, "tv");
}

export function getVimeusAnimes(pages: number[] = [1, 2]) {
  return listAsMedia("animes", pages, "tv");
}

export async function getVimeusHomeCatalog() {
  const [movies, series, animes, moviesP3, seriesP3] = await Promise.all([
    getVimeusMovies([1]),
    getVimeusSeries([1]),
    getVimeusAnimes([1]),
    getVimeusMovies([2]),
    getVimeusSeries([2]),
  ]);

  return {
    movies,
    series,
    animes,
    moreMovies: moviesP3,
    moreSeries: seriesP3,
  };
}

/** Completa sinopsis y metadatos desde TMDB (Vimeus listing no los trae). */
export async function enrichWithTmdb(item: MediaItem): Promise<MediaItem> {
  try {
    const type = item.media_type ?? "movie";
    const details = await getMediaDetails(type, item.id);
    return {
      ...item,
      overview: details.overview || item.overview,
      vote_average: details.vote_average ?? item.vote_average,
      release_date: details.release_date ?? item.release_date,
      first_air_date: details.first_air_date ?? item.first_air_date,
      poster_path: item.poster_path || details.poster_path,
      backdrop_path: item.backdrop_path || details.backdrop_path,
      title: item.title || details.title,
      name: item.name || details.name,
      genre_ids: details.genres?.map((g) => g.id) ?? item.genre_ids,
    };
  } catch {
    return item;
  }
}
