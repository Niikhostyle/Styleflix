"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getVimeusEmbedUrl } from "@/lib/vimeus";
import { isBackKey } from "@/lib/tv";
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
 * Iframe Vimeus a pantalla completa.
 * Back del mando / Escape / historial WebView cierran el player.
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
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setFrameNonce((n) => n + 1);
  }, [open, mediaId, mediaType, season, episode, isAnime]);

  // Historial: Back nativo del WebView cierra el modal
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

    const focusBack = () => backBtnRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(focusBack, 80);

    // Reclamar foco periódicamente (el iframe lo roba)
    const interval = window.setInterval(() => {
      const active = document.activeElement;
      if (active?.tagName === "IFRAME") {
        focusBack();
      }
    }, 1200);

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
      window.clearTimeout(t);
      window.clearInterval(interval);
      window.removeEventListener("keydown", onKey, true);
    };
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

  function handleCloseClick() {
    closingRef.current = true;
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  }

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

      <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-xs text-neutral-200 backdrop-blur-sm md:text-sm">
        Atrás / Escape para salir del reproductor
      </p>

      {!embedPath ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold text-white">
            No se pudo reproducir
          </p>
          <button
            type="button"
            onClick={handleCloseClick}
            data-tv-focus
            className="tv-cta rounded bg-white px-4 py-2 text-sm font-bold text-black"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <iframe
          key={`player-${mediaId}-${season}-${episode}-${frameNonce}`}
          src={embedPath}
          title={title}
          tabIndex={-1}
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
