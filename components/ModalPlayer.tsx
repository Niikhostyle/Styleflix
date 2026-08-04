"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { getVimeusEmbedUrl } from "@/lib/vimeus";
import { isBackKey } from "@/lib/tv";
import {
  APP_NAME,
  PREVIEW_LIMIT_MS,
  previewStorageKey,
} from "@/lib/brand";
import { MEMBERSHIP_PRICE_CLP } from "@/lib/access";
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

function readPreviewMs(userId: string) {
  try {
    const raw = localStorage.getItem(previewStorageKey(userId));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePreviewMs(userId: string, ms: number) {
  try {
    localStorage.setItem(previewStorageKey(userId), String(Math.floor(ms)));
  } catch {
    /* ignore */
  }
}

/**
 * Iframe Vimeus a pantalla completa.
 * Sin membresía: máx. 5 min acumulados, luego invitación a pagar.
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
  const { data: session } = useSession();
  const membershipActive = Boolean(session?.user?.membershipActive);
  const userId = session?.user?.id || "anon";
  const isAdmin = session?.user?.role === "SUPER_ADMIN";
  const unlimited = membershipActive || isAdmin;

  const [frameNonce, setFrameNonce] = useState(0);
  const [paywall, setPaywall] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);
  const usedMsRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setFrameNonce((n) => n + 1);
  }, [open, mediaId, mediaType, season, episode, isAnime]);

  // Preview timer
  useEffect(() => {
    if (!open || unlimited) {
      setPaywall(false);
      setRemainingSec(null);
      return;
    }

    usedMsRef.current = readPreviewMs(userId);
    if (usedMsRef.current >= PREVIEW_LIMIT_MS) {
      setPaywall(true);
      setRemainingSec(0);
      return;
    }

    setPaywall(false);
    const started = Date.now();
    const base = usedMsRef.current;

    const tick = window.setInterval(() => {
      const elapsed = base + (Date.now() - started);
      usedMsRef.current = elapsed;
      writePreviewMs(userId, elapsed);
      const left = Math.max(0, PREVIEW_LIMIT_MS - elapsed);
      setRemainingSec(Math.ceil(left / 1000));
      if (elapsed >= PREVIEW_LIMIT_MS) {
        setPaywall(true);
        setRemainingSec(0);
        window.clearInterval(tick);
      }
    }, 1000);

    setRemainingSec(Math.ceil((PREVIEW_LIMIT_MS - base) / 1000));

    return () => {
      window.clearInterval(tick);
      const finalMs = base + (Date.now() - started);
      usedMsRef.current = Math.min(finalMs, PREVIEW_LIMIT_MS);
      writePreviewMs(userId, usedMsRef.current);
    };
  }, [open, unlimited, userId]);

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

  const embedPath = useMemo(() => {
    if (!open || paywall) return "";
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
  }, [open, paywall, mediaType, mediaId, season, episode, isAnime, frameNonce]);

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

  const price = MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL");
  const mins = remainingSec != null ? Math.floor(remainingSec / 60) : 0;
  const secs = remainingSec != null ? remainingSec % 60 : 0;

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

      {!unlimited && remainingSec != null && !paywall && (
        <div className="absolute right-3 top-3 z-20 rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-amber-200 backdrop-blur-sm md:right-6 md:top-6">
          Prueba {mins}:{String(secs).padStart(2, "0")}
        </div>
      )}

      {paywall ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#E50914]">
            {APP_NAME}
          </p>
          <h2 className="max-w-md text-2xl font-black text-white md:text-3xl">
            Se acabó tu preview de 5 minutos
          </h2>
          <p className="max-w-sm text-sm text-neutral-300">
            Activa la membresía mensual por ${price} CLP y mira sin límites
            películas, series y animes.
          </p>
          <Link
            href="/membresia"
            data-tv-focus
            data-tv-autofocus
            className="tv-cta rounded bg-[#E50914] px-6 py-3 text-base font-bold transition hover:bg-[#f6121d]"
          >
            Activar membresía
          </Link>
          <button
            type="button"
            onClick={handleCloseClick}
            data-tv-focus
            className="text-sm text-neutral-400 underline hover:text-white"
          >
            Volver al catálogo
          </button>
        </div>
      ) : !embedPath ? (
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
