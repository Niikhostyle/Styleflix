"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getVimeusEmbedUrl } from "@/lib/vimeus";
import type { MediaType } from "@/lib/tmdb";

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
  autoStart?: boolean;
  isAnime?: boolean;
}

/**
 * Solo iframe Vimeus a pantalla completa (sin chrome propio de episodios).
 */
export default function ModalPlayer({
  open,
  mediaId,
  mediaType,
  title,
  season = null,
  episode = null,
  onClose,
  isAnime = false,
}: ModalPlayerProps) {
  const [frameNonce, setFrameNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFrameNonce((n) => n + 1);
  }, [open, mediaId, mediaType, season, episode, isAnime]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const embedPath = useMemo(() => {
    if (!open) return "";
    try {
      return (
        getVimeusEmbedUrl(mediaType, mediaId, {
          season: mediaType === "tv" ? season ?? 1 : undefined,
          episode: mediaType === "tv" ? episode ?? 1 : undefined,
          anime: isAnime,
        }) + `&_r=${frameNonce}`
      );
    } catch {
      return "";
    }
  }, [open, mediaType, mediaId, season, episode, isAnime, frameNonce]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo ${title}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Volver"
        className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition hover:bg-white/15 md:left-6 md:top-6"
      >
        <ArrowLeft className="h-6 w-6" strokeWidth={2.25} />
        <span className="hidden text-sm font-semibold md:inline">Volver</span>
      </button>

      {!embedPath ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold text-white">
            No se pudo reproducir
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white px-4 py-2 text-sm font-bold text-black"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <iframe
          key={`player-${mediaId}-${season}-${episode}-${frameNonce}`}
          src={embedPath}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          width="100%"
          height="100%"
          frameBorder={0}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="origin"
        />
      )}
    </div>
  );
}
