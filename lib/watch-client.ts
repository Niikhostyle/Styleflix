/** Cliente: reporta progreso al historial (fire-and-forget). */

export type WatchReport = {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  season?: number | null;
  episode?: number | null;
  progressPct?: number;
  completed?: boolean;
};

export function reportWatchProgress(payload: WatchReport) {
  if (typeof window === "undefined") return;
  if (!payload.tmdbId || !payload.title) return;

  const body = JSON.stringify({
    mediaType: payload.mediaType,
    tmdbId: payload.tmdbId,
    title: payload.title.slice(0, 300),
    posterPath: payload.posterPath ?? null,
    season: payload.season ?? null,
    episode: payload.episode ?? null,
    progressPct: Math.min(
      100,
      Math.max(0, payload.progressPct ?? 8)
    ),
    completed: Boolean(payload.completed),
  });

  try {
    void fetch("/api/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
