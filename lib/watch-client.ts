/** Cliente: reporta progreso al historial (fire-and-forget). */

export type WatchReport = {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath?: string | null;
  season?: number | null;
  episode?: number | null;
  progressPct?: number;
  /** Segundos exactos del <video> (Drive / HLS). */
  positionSeconds?: number | null;
  completed?: boolean;
};

export type SavedWatchPosition = {
  positionSeconds: number;
  progressPct: number;
  season?: number | null;
  episode?: number | null;
  updatedAt: number;
};

function storageKey(
  mediaType: string,
  tmdbId: number,
  season?: number | null,
  episode?: number | null
) {
  if (mediaType === "tv") {
    return `veotv:pos:${mediaType}:${tmdbId}:s${season ?? 1}:e${episode ?? 1}`;
  }
  return `veotv:pos:${mediaType}:${tmdbId}`;
}

/** Caché local para retomar al instante (además de la DB). */
export function saveLocalWatchPosition(payload: WatchReport) {
  if (typeof window === "undefined") return;
  const secs = payload.positionSeconds;
  if (secs == null || !Number.isFinite(secs) || secs < 5) return;
  if (payload.completed) {
    try {
      localStorage.removeItem(
        storageKey(
          payload.mediaType,
          payload.tmdbId,
          payload.season,
          payload.episode
        )
      );
    } catch {
      /* ignore */
    }
    return;
  }
  const data: SavedWatchPosition = {
    positionSeconds: Math.floor(secs),
    progressPct: Math.min(100, Math.max(0, payload.progressPct ?? 0)),
    season: payload.season ?? null,
    episode: payload.episode ?? null,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(
      storageKey(
        payload.mediaType,
        payload.tmdbId,
        payload.season,
        payload.episode
      ),
      JSON.stringify(data)
    );
  } catch {
    /* ignore quota */
  }
}

export function loadLocalWatchPosition(opts: {
  mediaType: string;
  tmdbId: number;
  season?: number | null;
  episode?: number | null;
}): SavedWatchPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(
      storageKey(opts.mediaType, opts.tmdbId, opts.season, opts.episode)
    );
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedWatchPosition;
    if (!data?.positionSeconds || data.positionSeconds < 5) return null;
    // Descarta posiciones muy viejas (>60 días)
    if (Date.now() - (data.updatedAt || 0) > 60 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function reportWatchProgress(payload: WatchReport) {
  if (typeof window === "undefined") return;
  if (!payload.tmdbId || !payload.title) return;

  saveLocalWatchPosition(payload);

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
    positionSeconds:
      payload.positionSeconds != null && Number.isFinite(payload.positionSeconds)
        ? Math.max(0, Math.floor(payload.positionSeconds))
        : null,
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
