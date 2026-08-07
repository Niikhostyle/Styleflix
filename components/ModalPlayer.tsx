"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { isBackKey } from "@/lib/tv";
import type { MediaType } from "@/lib/tmdb";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { withPlaybackLockQuery } from "@/lib/playback-lock-url";
import HlsVideoPlayer from "@/components/HlsVideoPlayer";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import { reportWatchProgress, loadLocalWatchPosition } from "@/lib/watch-client";

function attachLockToPlayUrl(
  url: string,
  lock: { profileId: string; deviceId: string; lockToken: string } | null
) {
  if (!lock) return url;
  if (!url.includes("/api/play/")) return url;
  return withPlaybackLockQuery(url, lock);
}

export type SeasonMeta = {
  seasonNumber: number;
  episodeCount: number;
  name: string;
};

interface ModalPlayerProps {
  open: boolean;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  season?: number | null;
  episode?: number | null;
  seasons?: SeasonMeta[];
  onSeasonEpisodeChange?: (season: number, episode: number) => void;
  onClose: () => void;
  autoStart?: boolean;
  isAnime?: boolean;
}

/**
 * Player fullscreen. Series/anime: layout watch con Anterior/Siguiente + grilla.
 * Soporta iframe (embeds) y HLS nativo (p. ej. Pluto vía proxy).
 */
export default function ModalPlayer({
  open,
  mediaId,
  mediaType,
  title,
  year = null,
  posterPath = null,
  season = null,
  episode = null,
  seasons = [],
  onSeasonEpisodeChange,
  onClose,
  isAnime = false,
}: ModalPlayerProps) {
  const { data: session } = useSession();
  const membershipActive = Boolean(
    session?.user?.catalogAccess || session?.user?.membershipActive
  );
  const isAdmin = session?.user?.role === "SUPER_ADMIN";

  const [frameNonce, setFrameNonce] = useState(0);
  const [embedPath, setEmbedPath] = useState("");
  const [playKind, setPlayKind] = useState<"iframe" | "hls" | "video">("iframe");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [lockConflict, setLockConflict] = useState(false);
  /** Segundos guardados para retomar (Drive / HLS). */
  const [resumeAt, setResumeAt] = useState(0);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);
  const lockRef = useRef<{
    profileId: string;
    deviceId: string;
    lockToken: string;
  } | null>(null);

  const currentSeason = season ?? 1;
  const currentEpisode = episode ?? 1;
  const isSeries = mediaType === "tv";

  const seasonMeta = useMemo(() => {
    if (seasons.length) {
      return (
        seasons.find((s) => s.seasonNumber === currentSeason) || seasons[0]
      );
    }
    return {
      seasonNumber: currentSeason,
      episodeCount: Math.max(currentEpisode, 24),
      name: `Temporada ${currentSeason}`,
    };
  }, [seasons, currentSeason, currentEpisode]);

  const episodeNumbers = useMemo(() => {
    const count = Math.max(1, seasonMeta.episodeCount || 1);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [seasonMeta.episodeCount]);

  const sortedSeasons = useMemo(
    () => [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber),
    [seasons]
  );

  const canPrev =
    isSeries &&
    (currentEpisode > 1 ||
      sortedSeasons.some((s) => s.seasonNumber < currentSeason));

  const canNext =
    isSeries &&
    (currentEpisode < seasonMeta.episodeCount ||
      sortedSeasons.some((s) => s.seasonNumber > currentSeason));

  function goPrev() {
    if (!onSeasonEpisodeChange || !isSeries) return;
    if (currentEpisode > 1) {
      onSeasonEpisodeChange(currentSeason, currentEpisode - 1);
      return;
    }
    const prevSeasons = sortedSeasons.filter(
      (s) => s.seasonNumber < currentSeason
    );
    if (prevSeasons.length) {
      const prev = prevSeasons[prevSeasons.length - 1];
      onSeasonEpisodeChange(prev.seasonNumber, prev.episodeCount || 1);
    }
  }

  function goNext() {
    if (!onSeasonEpisodeChange || !isSeries) return;
    if (currentEpisode < seasonMeta.episodeCount) {
      onSeasonEpisodeChange(currentSeason, currentEpisode + 1);
      return;
    }
    const next = sortedSeasons.find((s) => s.seasonNumber > currentSeason);
    if (next) onSeasonEpisodeChange(next.seasonNumber, 1);
  }

  useEffect(() => {
    if (!open) {
      setEmbedPath("");
      setPlayKind("iframe");
      setSourceId(null);
      setSourceLabel("");
      setNotice("");
      setResolveError("");
      setLockConflict(false);
      setResolving(false);
      // Liberar lock al cerrar
      const lock = lockRef.current;
      lockRef.current = null;
      if (lock) {
        void fetch("/api/playback/lock", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lock),
          keepalive: true,
        }).catch(() => undefined);
      }
      return;
    }

    if (!membershipActive && !isAdmin) {
      setResolveError("Necesitas una membresía activa para reproducir.");
      return;
    }

    setFrameNonce((n) => n + 1);
    setResolving(true);
    setResolveError("");
    setLockConflict(false);
    setEmbedPath("");
    setPlayKind("iframe");
    setSourceId(null);
    setSourceLabel("");
    setNotice("");

    const params = new URLSearchParams({
      tmdb: String(mediaId),
      type: mediaType,
      title,
    });
    if (year) params.set("year", String(year));
    if (mediaType === "tv") {
      params.set("se", String(season ?? 1));
      params.set("ep", String(episode ?? 1));
      if (isAnime) params.set("anime", "1");
    }

    let cancelled = false;
    const deviceId = getOrCreateDeviceId();

    void (async () => {
      try {
        const acq = await fetch("/api/playback/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            titleLabel: title,
          }),
        });
        const acqData = await acq.json().catch(() => ({}));
        if (cancelled) return;

        if (!acq.ok) {
          setLockConflict(acq.status === 409);
          setResolveError(
            acqData.error ||
              "No se pudo iniciar la reproducción en este perfil."
          );
          setResolving(false);
          return;
        }

        const profileId = acqData.profileId as string;
        const lockToken = acqData.lockToken as string;
        lockRef.current = { profileId, deviceId, lockToken };

        const res = await fetch(`/api/play/resolve?${params}`, {
          headers: {
            "x-veotv-profile-id": profileId,
            "x-veotv-device-id": deviceId,
            "x-veotv-playback-token": lockToken,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        const url = (data.streamUrl || data.embedUrl || "") as string;
        if (!res.ok || !url) {
          // Liberar lock si no hay stream (evita bloquear el perfil ~45s+)
          const lock = lockRef.current;
          lockRef.current = null;
          if (lock) {
            void fetch("/api/playback/lock", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lock),
              keepalive: true,
            }).catch(() => undefined);
          }
          setLockConflict(res.status === 409);
          setResolveError(
            data.error || "Este título todavía no está disponible."
          );
          setEmbedPath("");
          setSourceId(null);
          return;
        }
        const kind =
          data.playKind === "hls"
            ? "hls"
            : data.playKind === "video"
              ? "video"
              : "iframe";
        const playUrl = attachLockToPlayUrl(url, lockRef.current);
        setPlayKind(kind);
        setEmbedPath(
          kind === "hls" || kind === "video"
            ? playUrl
            : `${playUrl}${playUrl.includes("?") ? "&" : "?"}_r=${Date.now()}`
        );
        setSourceId(data.source || null);
        setSourceLabel(
          typeof data.label === "string" && data.label
            ? data.label
            : typeof data.source === "string"
              ? data.source
              : "VeoTV"
        );
        setNotice(data.notice || "");
        reportWatchProgress({
          mediaType,
          tmdbId: mediaId,
          title,
          posterPath,
          season: mediaType === "tv" ? (season ?? 1) : null,
          episode: mediaType === "tv" ? (episode ?? 1) : null,
          progressPct: mediaType === "tv" ? 12 : 8,
          completed: false,
        });
      } catch {
        if (!cancelled) {
          const lock = lockRef.current;
          lockRef.current = null;
          if (lock) {
            void fetch("/api/playback/lock", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lock),
              keepalive: true,
            }).catch(() => undefined);
          }
          setResolveError("No se pudo resolver la reproducción.");
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    mediaId,
    mediaType,
    title,
    year,
    posterPath,
    season,
    episode,
    isAnime,
    membershipActive,
    isAdmin,
  ]);

  // Cargar posición guardada (local + API) al abrir / cambiar episodio
  useEffect(() => {
    if (!open) {
      setResumeAt(0);
      return;
    }

    const local = loadLocalWatchPosition({
      mediaType,
      tmdbId: mediaId,
      season: mediaType === "tv" ? currentSeason : null,
      episode: mediaType === "tv" ? currentEpisode : null,
    });
    if (local?.positionSeconds && local.positionSeconds >= 5) {
      setResumeAt(local.positionSeconds);
    } else {
      setResumeAt(0);
    }

    let cancelled = false;
    void fetch("/api/watch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaType, tmdbId: mediaId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const p = data.progress;
        if (!p || p.completed) return;
        if (mediaType === "tv") {
          const sameEp =
            (p.season ?? 1) === currentSeason &&
            (p.episode ?? 1) === currentEpisode;
          if (!sameEp) return;
        }
        const secs = Number(p.positionSeconds);
        if (Number.isFinite(secs) && secs >= 5) {
          setResumeAt((prev) => (secs > prev ? secs : prev));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [open, mediaId, mediaType, currentSeason, currentEpisode]);

  // Progreso estimado SOLO para embeds iframe (sin timeupdate real)
  useEffect(() => {
    if (!open || !embedPath || playKind !== "iframe") return;
    let pct = mediaType === "tv" ? 15 : 10;
    const id = window.setInterval(() => {
      pct = Math.min(mediaType === "movie" ? 85 : 70, pct + 4);
      reportWatchProgress({
        mediaType,
        tmdbId: mediaId,
        title,
        posterPath,
        season: mediaType === "tv" ? currentSeason : null,
        episode: mediaType === "tv" ? currentEpisode : null,
        progressPct: pct,
        completed: false,
      });
    }, 45_000);
    return () => window.clearInterval(id);
  }, [
    open,
    embedPath,
    playKind,
    mediaId,
    mediaType,
    title,
    posterPath,
    currentSeason,
    currentEpisode,
  ]);

  // Heartbeat cada 15s mientras el player está abierto
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const lock = lockRef.current;
      if (!lock) return;
      void fetch("/api/playback/lock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lock),
      })
        .then(async (res) => {
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            setEmbedPath("");
            setLockConflict(true);
            setResolveError(
              data.error ||
                "Este perfil empezó a usarse en otro dispositivo. Se cerró tu reproducción."
            );
            lockRef.current = null;
          }
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [open]);

  async function forceTakeover() {
    setResolving(true);
    setResolveError("");
    setLockConflict(false);
    const deviceId = getOrCreateDeviceId();
    const acq = await fetch("/api/playback/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, titleLabel: title, force: true }),
    });
    const acqData = await acq.json().catch(() => ({}));
    if (!acq.ok) {
      setResolveError(acqData.error || "No se pudo tomar el perfil.");
      setResolving(false);
      return;
    }
    lockRef.current = {
      profileId: acqData.profileId,
      deviceId,
      lockToken: acqData.lockToken,
    };
    // Re-disparar resolve: cerrar/abrir via frameNonce hack — reload page state
    setFrameNonce((n) => n + 1);
    setResolving(false);
    // Force re-run by toggling — simplest: window reload of player effect via key
    // Re-fetch resolve manually:
    const params = new URLSearchParams({
      tmdb: String(mediaId),
      type: mediaType,
      title,
    });
    if (year) params.set("year", String(year));
    if (mediaType === "tv") {
      params.set("se", String(season ?? 1));
      params.set("ep", String(episode ?? 1));
      if (isAnime) params.set("anime", "1");
    }
    setResolving(true);
    try {
      const res = await fetch(`/api/play/resolve?${params}`, {
        headers: {
          "x-veotv-profile-id": acqData.profileId,
          "x-veotv-device-id": deviceId,
          "x-veotv-playback-token": acqData.lockToken,
        },
      });
      const data = await res.json().catch(() => ({}));
      const url = (data.streamUrl || data.embedUrl || "") as string;
      if (!res.ok || !url) {
        setResolveError(data.error || "No disponible.");
        return;
      }
      const kind =
        data.playKind === "hls"
          ? "hls"
          : data.playKind === "video"
            ? "video"
            : "iframe";
      const playUrl = attachLockToPlayUrl(url, lockRef.current);
      setPlayKind(kind);
      setEmbedPath(
        kind === "hls" || kind === "video"
          ? playUrl
          : `${playUrl}${playUrl.includes("?") ? "&" : "?"}_r=${Date.now()}`
      );
      setSourceId(data.source || null);
      setSourceLabel(
        typeof data.label === "string" && data.label
          ? data.label
          : typeof data.source === "string"
            ? data.source
            : "VeoTV"
      );
      setNotice(data.notice || "");
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    pushedRef.current = true;
    closingRef.current = false;
    window.history.pushState({ sfPlayer: true }, "");

    const onPopState = () => {
      pushedRef.current = false;
      closingRef.current = true;
      onClose();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current && !closingRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const isTv = document.documentElement.classList.contains("tv-mode");
    let t: number | undefined;
    if (isTv) {
      t = window.setTimeout(() => {
        backBtnRef.current?.focus({ preventScroll: true });
      }, 80);
    }

    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      closingRef.current = true;
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      } else {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      if (t != null) window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleCloseClick() {
    closingRef.current = true;
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  }

  const showPlayer = Boolean(embedPath) && !resolving && !resolveError;

  const playerSurface = resolving ? (
    <div className="flex h-full items-center justify-center text-neutral-300">
      Buscando fuente…
    </div>
  ) : resolveError || !embedPath ? (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="max-w-lg text-lg font-semibold text-white">
        {resolveError || "Este título todavía no está disponible."}
      </p>
      {lockConflict && (
        <div className="max-w-md space-y-3">
          <p className="text-sm text-white/55">
            Cada perfil permite <strong className="text-cyan-200">1 sola
            pantalla</strong>. Si eras tú en otro dispositivo, puedes tomar el
            control (se corta la otra reproducción).
          </p>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void forceTakeover()}
            className="brand-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            Tomar control de este perfil
          </button>
        </div>
      )}
    </div>
  ) : playKind === "hls" ? (
    <HlsVideoPlayer
      key={`hls-${mediaId}-${season}-${episode}-${frameNonce}`}
      src={embedPath}
      title={title}
      startAtSeconds={resumeAt}
      onProgress={(progressPct, completed, positionSeconds) =>
        reportWatchProgress({
          mediaType,
          tmdbId: mediaId,
          title,
          posterPath,
          season: mediaType === "tv" ? currentSeason : null,
          episode: mediaType === "tv" ? currentEpisode : null,
          progressPct,
          positionSeconds,
          completed,
        })
      }
    />
  ) : playKind === "video" ? (
    <NativeVideoPlayer
      key={`video-${mediaId}-${season}-${episode}-${frameNonce}`}
      src={embedPath}
      title={title}
      startAtSeconds={resumeAt}
      onProgress={(progressPct, completed, positionSeconds) =>
        reportWatchProgress({
          mediaType,
          tmdbId: mediaId,
          title,
          posterPath,
          season: mediaType === "tv" ? currentSeason : null,
          episode: mediaType === "tv" ? currentEpisode : null,
          progressPct,
          positionSeconds,
          completed,
        })
      }
    />
  ) : (
    <iframe
      key={`player-${mediaId}-${season}-${episode}-${frameNonce}-${sourceId}`}
      src={embedPath}
      title={title}
      tabIndex={-1}
      className="absolute inset-0 h-full w-full border-0"
      width="100%"
      height="100%"
      frameBorder={0}
      allowFullScreen
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy={
        sourceId && sourceId !== "vimeus"
          ? "no-referrer-when-downgrade"
          : "origin"
      }
    />
  );

  // Series / TV anime: layout tipo watch
  if (isSeries) {
    return (
      <div
        className="fixed inset-0 z-[100] overflow-y-auto bg-[#07090f]"
        role="dialog"
        aria-modal="true"
        aria-label={`Reproduciendo ${title}`}
        data-tv-player="open"
      >
        <div className="mx-auto max-w-[1400px] px-3 pb-10 pt-4 sm:px-5 md:px-8">
          <button
            ref={backBtnRef}
            type="button"
            onClick={handleCloseClick}
            aria-label="Volver"
            data-tv-autofocus
            data-tv-focus
            className="tv-cta mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:border-teal-300/30 hover:bg-teal-300/10"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            Volver
          </button>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                {playerSurface}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canPrev || resolving}
                  onClick={goPrev}
                  data-tv-focus
                  className="tv-cta inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:border-teal-300/35 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!canNext || resolving}
                  onClick={goNext}
                  data-tv-focus
                  className="tv-cta inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:border-teal-300/35 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {sourceLabel && showPlayer && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                  <span className="rounded-lg bg-teal-400 px-3.5 py-2 text-sm font-semibold text-black shadow-md shadow-teal-400/25">
                    {sourceLabel}
                  </span>
                </div>
              )}

              {notice && showPlayer && (
                <p className="mt-2 text-xs text-amber-200/80">{notice}</p>
              )}

              <div className="mt-6">
                <p className="text-sm font-semibold text-teal-300">{title}</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {seasonMeta.name} · Episodio {currentEpisode}
                </h2>
                {year && (
                  <p className="mt-2 text-sm text-white/45">{year}</p>
                )}
              </div>
            </div>

            <aside className="rounded-xl border border-white/[0.08] bg-[#0c1018] p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Estás viendo
              </p>
              <p className="mt-1 text-base font-bold text-white">
                Episodio {currentEpisode}
              </p>

              {sortedSeasons.length > 1 && (
                <label className="mt-3 flex flex-col gap-1.5 text-xs text-white/45">
                  Temporada
                  <select
                    value={currentSeason}
                    data-tv-focus
                    onChange={(e) =>
                      onSeasonEpisodeChange?.(Number(e.target.value), 1)
                    }
                    className="rounded-lg border border-white/10 bg-[#0a1220] px-2.5 py-2 text-sm text-white outline-none focus:border-teal-300/50"
                  >
                    {sortedSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
                {episodeNumbers.map((n) => {
                  const active = n === currentEpisode;
                  return (
                    <button
                      key={n}
                      type="button"
                      data-tv-focus
                      disabled={resolving}
                      onClick={() =>
                        onSeasonEpisodeChange?.(currentSeason, n)
                      }
                      className={`aspect-square rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
                        active
                          ? "border-2 border-teal-400 bg-teal-400/10 text-teal-200"
                          : "border border-transparent bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  // Películas: fullscreen clásico
  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo ${title}`}
      data-tv-player="open"
    >
      <button
        ref={backBtnRef}
        type="button"
        onClick={handleCloseClick}
        aria-label="Volver"
        data-tv-autofocus
        data-tv-focus
        className="tv-cta absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-white/15 md:left-6 md:top-6"
      >
        <ArrowLeft className="h-6 w-6" strokeWidth={2.25} />
        <span className="text-sm font-semibold">Volver</span>
      </button>

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2 md:right-6 md:top-6">
        {notice && showPlayer && (
          <span className="max-w-[260px] rounded bg-black/70 px-3 py-1.5 text-right text-xs font-medium text-amber-200 backdrop-blur-sm">
            {notice}
          </span>
        )}
      </div>

      {playerSurface}
    </div>
  );
}
