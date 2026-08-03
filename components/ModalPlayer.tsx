"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { getVimeusEmbedUrl } from "@/lib/vimeus";
import {
  IMAGE_BASE_URL,
  IMAGE_BACKDROP_URL,
  type EpisodeInfo,
  type MediaType,
} from "@/lib/tmdb";

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
  posterPath?: string | null;
  backdropPath?: string | null;
  season?: number | null;
  episode?: number | null;
  seasons?: SeasonMeta[];
  onSeasonEpisodeChange?: (season: number, episode: number) => void;
  onClose: () => void;
  /** Si true, al abrir arranca playback sin pedir un segundo clic. */
  autoStart?: boolean;
  /** Usar embed /e/anime de Vimeus (animes). */
  isAnime?: boolean;
}

export default function ModalPlayer({
  open,
  mediaId,
  mediaType,
  title,
  posterPath = null,
  backdropPath = null,
  season = null,
  episode = null,
  seasons = [],
  onSeasonEpisodeChange,
  onClose,
  autoStart = true,
  isAnime = false,
}: ModalPlayerProps) {
  const { status } = useSession();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [pickerSeason, setPickerSeason] = useState(season ?? 1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [playbackEpisodes, setPlaybackEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [activeSeason, setActiveSeason] = useState(season ?? 1);
  const [activeEpisode, setActiveEpisode] = useState(episode ?? 1);
  const [frameNonce, setFrameNonce] = useState(0);
  /** cover → stream Vimeus */
  const [phase, setPhase] = useState<"cover" | "stream">("cover");
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [showVimeusHint, setShowVimeusHint] = useState(false);

  const beginPlayback = useCallback(() => {
    setChromeVisible(true);
    setEmbedError(null);
    setShowVimeusHint(false);
    setPhase("stream");
    setFrameNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveSeason(season ?? 1);
    setActiveEpisode(episode ?? 1);
    setFrameNonce((n) => n + 1);
    setEmbedError(null);
    if (autoStart) beginPlayback();
    else setPhase("cover");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "stream") {
      setShowVimeusHint(false);
      return;
    }
    const t = window.setTimeout(() => setShowVimeusHint(true), 10000);
    return () => window.clearTimeout(t);
  }, [open, phase, frameNonce]);

  useEffect(() => {
    if (!open) return;
    const s = season ?? 1;
    const e = episode ?? 1;
    setActiveSeason((prev) => (prev === s ? prev : s));
    setActiveEpisode((prev) => (prev === e ? prev : e));
  }, [open, season, episode]);

  /** Al cambiar de capítulo, reiniciar playback */
  useEffect(() => {
    if (!open) return;
    setEmbedError(null);
    if (autoStart) beginPlayback();
    else setPhase("cover");
  }, [open, activeSeason, activeEpisode, mediaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonMeta = useMemo(
    () => seasons.find((s) => s.seasonNumber === activeSeason),
    [seasons, activeSeason]
  );

  const episodeCount = useMemo(() => {
    if (playbackEpisodes.length > 0) return playbackEpisodes.length;
    if (seasonMeta?.episodeCount && seasonMeta.episodeCount > 0) {
      return seasonMeta.episodeCount;
    }
    return 50;
  }, [playbackEpisodes.length, seasonMeta?.episodeCount]);

  const currentEp = useMemo(
    () =>
      playbackEpisodes.find((e) => e.episode_number === activeEpisode) ??
      episodes.find((e) => e.episode_number === activeEpisode),
    [playbackEpisodes, episodes, activeEpisode]
  );

  const nextTarget = useMemo(() => {
    if (mediaType !== "tv") return null;
    if (activeEpisode < episodeCount) {
      return { season: activeSeason, episode: activeEpisode + 1 };
    }
    const idx = seasons.findIndex((s) => s.seasonNumber === activeSeason);
    const next = idx >= 0 && idx < seasons.length - 1 ? seasons[idx + 1] : null;
    if (!next) return null;
    return { season: next.seasonNumber, episode: 1 };
  }, [mediaType, activeEpisode, episodeCount, activeSeason, seasons]);

  const revealChrome = useCallback(() => setChromeVisible(true), []);

  const goTo = useCallback(
    (nextSeason: number, nextEpisode: number) => {
      setActiveSeason(nextSeason);
      setActiveEpisode(nextEpisode);
      setFrameNonce((n) => n + 1);
      setChromeVisible(true);
      setListOpen(false);
      onSeasonEpisodeChange?.(nextSeason, nextEpisode);
    },
    [onSeasonEpisodeChange]
  );

  const goPrev = useCallback(() => {
    if (mediaType !== "tv") return;
    if (activeEpisode > 1) {
      goTo(activeSeason, activeEpisode - 1);
      return;
    }
    const idx = seasons.findIndex((s) => s.seasonNumber === activeSeason);
    const prev = idx > 0 ? seasons[idx - 1] : null;
    if (prev) {
      goTo(
        prev.seasonNumber,
        prev.episodeCount > 1 ? prev.episodeCount : playbackEpisodes.length || 1
      );
    }
  }, [
    mediaType,
    activeEpisode,
    activeSeason,
    seasons,
    goTo,
    playbackEpisodes.length,
  ]);

  const goNext = useCallback(() => {
    if (!nextTarget) return;
    goTo(nextTarget.season, nextTarget.episode);
  }, [goTo, nextTarget]);

  const canPrev =
    mediaType === "tv" &&
    (activeEpisode > 1 ||
      seasons.findIndex((s) => s.seasonNumber === activeSeason) > 0);
  const canNext = Boolean(nextTarget);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (listOpen) setListOpen(false);
        else onClose();
      }
      if (mediaType === "tv" && e.key === "ArrowLeft" && (e.altKey || e.shiftKey)) {
        e.preventDefault();
        goPrev();
      }
      if (mediaType === "tv" && e.key === "ArrowRight" && (e.altKey || e.shiftKey)) {
        e.preventDefault();
        goNext();
      }
      if (mediaType === "tv" && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        goNext();
      }
      setChromeVisible(true);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, listOpen, mediaType, goPrev, goNext]);

  useEffect(() => {
    if (!open || !chromeVisible || listOpen) return;
    const timer = window.setTimeout(() => setChromeVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [open, chromeVisible, listOpen]);

  useEffect(() => {
    if (!open || status !== "authenticated") return;
    void fetch("/api/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType,
        tmdbId: mediaId,
        title,
        posterPath,
        season: mediaType === "tv" ? activeSeason : null,
        episode: mediaType === "tv" ? activeEpisode : null,
        progressPct: 10,
      }),
    });
  }, [
    open,
    status,
    mediaType,
    mediaId,
    title,
    posterPath,
    activeSeason,
    activeEpisode,
  ]);

  useEffect(() => {
    if (!open || mediaType !== "tv") return;
    void fetch(`/api/tv/${mediaId}/season/${activeSeason}`)
      .then((r) => r.json())
      .then((data) => setPlaybackEpisodes(data.episodes ?? []))
      .catch(() => setPlaybackEpisodes([]));
  }, [open, mediaType, mediaId, activeSeason]);

  useEffect(() => {
    if (!open || mediaType !== "tv" || !listOpen) return;
    setLoadingEps(true);
    void fetch(`/api/tv/${mediaId}/season/${pickerSeason}`)
      .then((r) => r.json())
      .then((data) => setEpisodes(data.episodes ?? []))
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEps(false));
  }, [open, mediaType, listOpen, mediaId, pickerSeason]);

  useEffect(() => {
    if (!open || mediaType !== "tv" || !listOpen) return;
    setPickerSeason(activeSeason);
  }, [open, mediaType, listOpen, activeSeason]);

  if (!open) return null;

  let embedPath = "";
  let embedBuildError: string | null = null;
  try {
    embedPath =
      getVimeusEmbedUrl(mediaType, mediaId, {
        season: mediaType === "tv" ? activeSeason : undefined,
        episode: mediaType === "tv" ? activeEpisode : undefined,
        anime: isAnime,
      }) + `&_r=${frameNonce}`;
  } catch (err) {
    embedBuildError =
      err instanceof Error ? err.message : "No se pudo generar el embed";
  }

  const subtitle =
    mediaType === "tv" ? ` · T${activeSeason} E${activeEpisode}` : "";

  const coverSrc =
    (currentEp?.still_path
      ? `${IMAGE_BACKDROP_URL}${currentEp.still_path}`
      : null) ||
    (backdropPath ? `${IMAGE_BACKDROP_URL}${backdropPath}` : null) ||
    (posterPath ? `${IMAGE_BASE_URL}${posterPath}` : null);

  return (
    <div
      className="player-enter fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo ${title}`}
      onMouseMove={revealChrome}
      onTouchStart={revealChrome}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 h-28 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-500 ${
          chromeVisible || listOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <header
        className={`absolute inset-x-0 top-0 z-40 flex items-center gap-3 px-4 py-4 transition-all duration-500 md:px-8 md:py-6 ${
          chromeVisible || listOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver"
          className="flex items-center gap-2 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-white/15 md:gap-3 md:px-4"
        >
          <ArrowLeft className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.25} />
          <span className="hidden text-sm font-semibold tracking-wide md:inline">
            Volver
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-white drop-shadow-lg md:text-xl">
            {title}
            <span className="font-normal text-neutral-300">{subtitle}</span>
          </h3>
          {currentEp?.name && (
            <p className="truncate text-xs text-neutral-400 md:text-sm">
              {currentEp.name}
            </p>
          )}
        </div>

        {mediaType === "tv" && (
          <button
            type="button"
            onClick={() => {
              setListOpen((v) => !v);
              setChromeVisible(true);
            }}
            className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            <ListVideo className="h-5 w-5" />
            <span className="hidden sm:inline">Episodios</span>
          </button>
        )}
      </header>

      <div className="absolute inset-0 bg-black">
        {(embedError || embedBuildError) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
            <p className="text-lg font-semibold text-white">
              No se pudo reproducir
            </p>
            <p className="max-w-md text-sm text-neutral-400">
              {embedError || embedBuildError}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-white px-4 py-2 text-sm font-bold text-black"
            >
              Cerrar
            </button>
          </div>
        )}

        {phase === "stream" && embedPath && (
          <iframe
            key={`player-${mediaId}-${activeSeason}-${activeEpisode}-${frameNonce}-${isAnime ? "a" : "s"}`}
            src={embedPath}
            title={`${title}${subtitle}`}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="no-referrer"
          />
        )}

        {phase === "stream" && showVimeusHint && !embedError && !embedBuildError && (
          <div className="absolute bottom-20 left-1/2 z-20 w-[min(92%,28rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-black/85 px-4 py-3 text-center md:bottom-24">
            <p className="text-sm text-neutral-200">
              Si sigue en negro, Vimeus probablemente no tiene este título.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-xs font-semibold text-white underline"
            >
              Cerrar reproductor
            </button>
          </div>
        )}

        {phase === "cover" && (
          <button
            type="button"
            onClick={beginPlayback}
            className="group absolute inset-0 z-20 flex flex-col items-center justify-center"
            aria-label={`Reproducir ${title}${subtitle}`}
          >
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40" />
            <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-black shadow-2xl transition group-hover:scale-105 group-hover:bg-white">
                <Play className="h-9 w-9 translate-x-0.5 fill-black" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E50914]">
                  StyleFlix
                </p>
                <p className="mt-1 max-w-lg text-xl font-bold text-white drop-shadow md:text-3xl">
                  {title}
                  {subtitle}
                </p>
                {currentEp?.name && (
                  <p className="mt-1 text-sm text-neutral-300">{currentEp.name}</p>
                )}
                <p className="mt-3 text-sm text-neutral-400">
                  Pulsa para reproducir
                </p>
              </div>
            </div>
          </button>
        )}
      </div>

      {mediaType === "tv" && (
        <div
          className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-6 pt-20 transition-all duration-500 md:px-8 ${
            chromeVisible && !listOpen && phase === "stream"
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 md:gap-5">
            <button
              type="button"
              disabled={!canPrev}
              onClick={goPrev}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SkipBack className="h-5 w-5" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="rounded-full bg-black/50 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm">
              T{activeSeason} · E{activeEpisode}
              <span className="text-neutral-400"> / {episodeCount}</span>
            </div>

            <button
              type="button"
              disabled={!canNext}
              onClick={goNext}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            Tecla N · Siguiente · Shift + ← / →
          </p>
        </div>
      )}

      {mediaType === "tv" && listOpen && (
        <aside className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#141414]/97 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <h4 className="text-lg font-semibold">Episodios</h4>
            <button
              type="button"
              aria-label="Cerrar lista"
              onClick={() => setListOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <button
              type="button"
              aria-label="Temporada anterior"
              disabled={
                seasons.findIndex((s) => s.seasonNumber === pickerSeason) <= 0
              }
              onClick={() => {
                const idx = seasons.findIndex(
                  (s) => s.seasonNumber === pickerSeason
                );
                if (idx > 0) setPickerSeason(seasons[idx - 1].seasonNumber);
              }}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <select
              value={pickerSeason}
              onChange={(e) => setPickerSeason(Number(e.target.value))}
              className="flex-1 rounded border border-white/15 bg-black/50 px-3 py-2 text-sm outline-none"
            >
              {seasons.map((s) => (
                <option key={s.seasonNumber} value={s.seasonNumber}>
                  {s.name || `Temporada ${s.seasonNumber}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Temporada siguiente"
              disabled={
                seasons.findIndex((s) => s.seasonNumber === pickerSeason) >=
                seasons.length - 1
              }
              onClick={() => {
                const idx = seasons.findIndex(
                  (s) => s.seasonNumber === pickerSeason
                );
                if (idx < seasons.length - 1) {
                  setPickerSeason(seasons[idx + 1].seasonNumber);
                }
              }}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="scrollbar-hide flex-1 overflow-y-auto p-3">
            {loadingEps && (
              <p className="px-2 py-4 text-sm text-neutral-400">Cargando...</p>
            )}
            {!loadingEps &&
              episodes.map((ep) => {
                const active =
                  ep.season_number === activeSeason &&
                  ep.episode_number === activeEpisode;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => goTo(ep.season_number, ep.episode_number)}
                    className={`mb-2 flex w-full gap-3 rounded-md p-2 text-left transition ${
                      active
                        ? "bg-white/15 ring-1 ring-white/30"
                        : "hover:bg-white/8"
                    }`}
                  >
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-zinc-800">
                      {ep.still_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${IMAGE_BASE_URL}${ep.still_path}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                          E{ep.episode_number}
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 text-[10px] font-bold">
                        {ep.episode_number}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-sm font-semibold">
                        {ep.episode_number}. {ep.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">
                        {ep.overview || "Sin descripción"}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </aside>
      )}
    </div>
  );
}
