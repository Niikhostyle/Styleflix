import { prisma } from "@/lib/prisma";

export type CustomStreamMatch = {
  id: string;
  embedUrl: string;
  label: string;
  title: string | null;
  season: number | null;
  episode: number | null;
  priority: number;
};

/**
 * Busca un link propio habilitado por TMDB ID.
 * En series: prioriza episodio exacto → temporada → título completo.
 */
export async function findCustomStream(opts: {
  mediaType: "movie" | "tv";
  tmdbId: number;
  season?: number;
  episode?: number;
}): Promise<CustomStreamMatch | null> {
  const rows = await prisma.streamOverride.findMany({
    where: {
      mediaType: opts.mediaType,
      tmdbId: opts.tmdbId,
      enabled: true,
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  if (!rows.length) return null;

  const map = (r: (typeof rows)[number]): CustomStreamMatch => ({
    id: r.id,
    embedUrl: r.embedUrl,
    label: r.label || "VeoTV",
    title: r.title,
    season: r.season,
    episode: r.episode,
    priority: r.priority,
  });

  if (opts.mediaType === "movie") {
    return map(rows[0]);
  }

  const se = opts.season ?? null;
  const ep = opts.episode ?? null;

  const exact = rows.find(
    (r) =>
      se != null &&
      ep != null &&
      r.season === se &&
      r.episode === ep
  );
  if (exact) return map(exact);

  const seasonOnly = rows.find(
    (r) => se != null && r.season === se && r.episode == null
  );
  if (seasonOnly) return map(seasonOnly);

  const titleLevel = rows.find((r) => r.season == null && r.episode == null);
  if (titleLevel) return map(titleLevel);

  return map(rows[0]);
}
