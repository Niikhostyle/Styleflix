import type { MediaItem, MediaType } from "@/lib/tmdb";

export type SourceId =
  | "vimeus"
  | "tmdb"
  | "jikan"
  | "pluto"
  | "archive"
  | "animeav1"
  | "mangadex";

export const ALL_SOURCES: SourceId[] = [
  "vimeus",
  "tmdb",
  "jikan",
  "pluto",
  "archive",
  "animeav1",
  "mangadex",
];

export const SOURCE_LABELS: Record<SourceId, string> = {
  vimeus: "Vimeus",
  tmdb: "TMDB",
  jikan: "MyAnimeList",
  pluto: "Pluto TV",
  archive: "Archive.org",
  animeav1: "VeoTV",
  mangadex: "Mangas ES",
};

/**
 * Ítem de catálogo: un `MediaItem` de TMDB más de qué fuentes vino y si
 * sabemos que tiene stream. Los campos son opcionales para que cualquier
 * `MediaItem[]` existente siga siendo compatible.
 */
export type CatalogItem = MediaItem & {
  sources?: SourceId[];
  /** true = stream confirmado; false = solo ficha y tráiler. */
  playable?: boolean;
  /** Slug en AnimeAV1 (catálogo /anime/[slug]). */
  animeAv1Slug?: string;
  /** Slug manga ES (/manga/[slug]). */
  mangaSlug?: string;
  mangaDexId?: string;
};

export type CatalogRow = {
  title: string;
  items: CatalogItem[];
  mediaType?: MediaType;
};

/**
 * Fuentes activas. Se controla con CATALOG_SOURCES (lista separada por comas).
 * Por defecto se omiten fuentes ruidosas/redundantes (jikan): el anime va por
 * AnimeAV1. Para reactivar: CATALOG_SOURCES=vimeus,tmdb,jikan,pluto,archive,animeav1
 */
export function enabledSources(): SourceId[] {
  const raw = (process.env.CATALOG_SOURCES || "").trim();
  const requested = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is SourceId => ALL_SOURCES.includes(s as SourceId))
    : ALL_SOURCES.filter((id) => id !== "jikan");

  const disabled = new Set(
    (process.env.CATALOG_DISABLE || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  let list = requested.filter((id) => {
    if (disabled.has(id)) return false;
    if (id === "vimeus") return Boolean(process.env.VIMEUS_API_KEY);
    if (id === "tmdb" || id === "jikan") {
      return Boolean(process.env.NEXT_PUBLIC_TMDB_API_KEY);
    }
    if (id === "animeav1") return true;
    if (id === "mangadex") return true;
    return true;
  });

  // Secciones propias: si CATALOG_SOURCES está seteado sin ellas, igual se
  // mantienen activas (salvo CATALOG_DISABLE).
  for (const id of ["mangadex", "animeav1"] as const) {
    if (!disabled.has(id) && !list.includes(id)) list.push(id);
  }

  return list;
}

export function isSourceEnabled(id: SourceId): boolean {
  return enabledSources().includes(id);
}

function dedupeKey(item: CatalogItem, fallbackType?: MediaType): string {
  return `${item.media_type ?? fallbackType ?? "movie"}-${item.id}`;
}

export function toCatalogItem(
  item: MediaItem,
  source: SourceId,
  playable: boolean
): CatalogItem {
  return { ...item, sources: [source], playable };
}

/**
 * Une listas de distintas fuentes: deduplica por tipo + id TMDB, acumula las
 * fuentes de cada título, se queda con el mejor metadato disponible y marca
 * como reproducible si al menos una fuente lo confirma.
 */
export function mergeCatalogItems(
  lists: CatalogItem[][],
  opts?: { fallbackType?: MediaType; limit?: number }
): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();

  for (const list of lists) {
    for (const item of list) {
      if (!Number.isFinite(item.id) || item.id <= 0) continue;
      const key = dedupeKey(item, opts?.fallbackType);
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, {
          ...item,
          media_type: item.media_type ?? opts?.fallbackType,
          sources: [...(item.sources ?? [])],
        });
        continue;
      }

      const sources = new Set([
        ...(existing.sources ?? []),
        ...(item.sources ?? []),
      ]);

      byKey.set(key, {
        ...existing,
        sources: [...sources],
        playable: Boolean(existing.playable) || Boolean(item.playable),
        overview: existing.overview || item.overview,
        poster_path: existing.poster_path ?? item.poster_path,
        backdrop_path: existing.backdrop_path ?? item.backdrop_path,
        vote_average: existing.vote_average ?? item.vote_average,
        release_date: existing.release_date ?? item.release_date,
        first_air_date: existing.first_air_date ?? item.first_air_date,
        genre_ids: existing.genre_ids ?? item.genre_ids,
        animeAv1Slug: existing.animeAv1Slug || item.animeAv1Slug,
      });
    }
  }

  const merged = [...byKey.values()];
  return opts?.limit ? merged.slice(0, opts.limit) : merged;
}

/**
 * Ordena dejando primero lo reproducible: evita que las filas empiecen con
 * títulos que solo tienen ficha.
 */
export function playableFirst(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort((a, b) => {
    const diff = Number(Boolean(b.playable)) - Number(Boolean(a.playable));
    if (diff !== 0) return diff;
    return (b.vote_average ?? 0) - (a.vote_average ?? 0);
  });
}
