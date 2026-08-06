/** Resuelve URL de póster/backdrop (TMDB relativo o URL absoluta p.ej. AnimeAV1). */
export function mediaImageUrl(
  path: string | null | undefined,
  kind: "poster" | "backdrop" = "poster"
): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return `https:${path}`;
  const base =
    kind === "backdrop"
      ? "https://image.tmdb.org/t/p/original"
      : "https://image.tmdb.org/t/p/w500";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Href de ficha: Manga ES, AnimeAV1 nativo o título TMDB. */
export function catalogItemHref(item: {
  id: number;
  media_type?: string | null;
  animeAv1Slug?: string | null;
  mangaSlug?: string | null;
}): string {
  if (item.mangaSlug) return `/manga/${encodeURIComponent(item.mangaSlug)}`;
  if (item.animeAv1Slug) return `/anime/${encodeURIComponent(item.animeAv1Slug)}`;
  const type = item.media_type === "movie" ? "movie" : "tv";
  return `/titulo/${type}/${item.id}`;
}
