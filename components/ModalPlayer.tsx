"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { isBackKey } from "@/lib/tv";
import type { MediaType } from "@/lib/tmdb";
import HlsVideoPlayer from "@/components/HlsVideoPlayer";

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
 * Player fullscreen. Sin preview: requiere membresía (middleware).
 * Soporta iframe (embeds) y HLS nativo (p. ej. Pluto vía proxy).
 */
export default function ModalPlayer({
  open,
  mediaId,
  mediaType,
  title,
  year = null,
  season = null,
  episode = null,
  onClose,
  isAnime = false,
}: ModalPlayerProps) {
  const { data: session } = useSession();
  const membershipActive = Boolean(session?.user?.membershipActive);
  const isAdmin = session?.user?.role === "SUPER_ADMIN";

  const [frameNonce, setFrameNonce] = useState(0);
  const [embedPath, setEmbedPath] = useState("");
  const [playKind, setPlayKind] = useState<"iframe" | "hls">("iframe");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setEmbedPath("");
      setPlayKind("iframe");
      setSourceId(null);
      setNotice("");
      setResolveError("");
      setResolving(false);
      return;
    }

    if (!membershipActive && !isAdmin) {
      setResolveError("Necesitas una membresía activa para reproducir.");
      return;
    }

    setFrameNonce((n) => n + 1);
    setResolving(true);
    setResolveError("");
    setEmbedPath("");
    setPlayKind("iframe");
    setSourceId(null);
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
    void fetch(`/api/play/resolve?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const url = (data.streamUrl || data.embedUrl || "") as string;
        if (!res.ok || !url) {
          setResolveError(
            data.error ||
              "Este título todavía no está disponible."
          );
          setEmbedPath("");
          setSourceId(null);
          return;
        }
        const kind = data.playKind === "hls" ? "hls" : "iframe";
        setPlayKind(kind);
        setEmbedPath(
          kind === "hls"
            ? url
            : `${url}${url.includes("?") ? "&" : "?"}_r=${Date.now()}`
        );
        setSourceId(data.source || null);
        setNotice(data.notice || "");
      })
      .catch(() => {
        if (!cancelled) {
          setResolveError("No se pudo resolver la reproducción.");
        }
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    mediaId,
    mediaType,
    title,
    year,
    season,
    episode,
    isAnime,
    membershipActive,
    isAdmin,
  ]);

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

      {resolving ? (
        <div className="flex h-full items-center justify-center text-neutral-300">
          Buscando fuente…
        </div>
      ) : resolveError || !embedPath ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold text-white">
            {resolveError ||
              "Este título todavía no está disponible."}
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
      ) : playKind === "hls" ? (
        <HlsVideoPlayer
          key={`hls-${mediaId}-${season}-${episode}-${frameNonce}`}
          src={embedPath}
          title={title}
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
      )}
    </div>
  );
}
