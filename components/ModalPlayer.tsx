"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { isBackKey } from "@/lib/tv";
import {
  APP_NAME,
  DEFAULT_PREVIEW_MINUTES,
  previewStorageKey,
} from "@/lib/brand";
import { useMembershipPrice } from "@/components/PricingProvider";
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
 * Player fullscreen. La fuente la decide /api/play/resolve en cascada:
 * Vimeus → Pluto TV → Archive.org → tráiler.
 * Sin membresía: máx. 5 min acumulados, luego invitación a pagar.
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
  const { label: price } = useMembershipPrice();
  const membershipActive = Boolean(session?.user?.membershipActive);
  const userId = session?.user?.id || "anon";
  const isAdmin = session?.user?.role === "SUPER_ADMIN";
  const unlimited = membershipActive || isAdmin;

  const [frameNonce, setFrameNonce] = useState(0);
  const [paywall, setPaywall] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [previewLimitMs, setPreviewLimitMs] = useState(
    DEFAULT_PREVIEW_MINUTES * 60 * 1000
  );
  const [embedPath, setEmbedPath] = useState("");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);
  const usedMsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/preview")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const mins = Number(data.previewMinutes);
        if (Number.isFinite(mins) && mins >= 1) {
          setPreviewLimitMs(Math.floor(mins) * 60 * 1000);
        }
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setEmbedPath("");
      setSourceLabel(null);
      setSourceId(null);
      setNotice("");
      setResolveError("");
      setResolving(false);
      return;
    }

    setFrameNonce((n) => n + 1);
    setResolving(true);
    setResolveError("");
    setEmbedPath("");
    setSourceLabel(null);
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
        if (!res.ok || !data.embedUrl) {
          setResolveError(
            data.error ||
              "Este título todavía no está disponible en ninguna fuente."
          );
          setEmbedPath("");
          setSourceLabel(null);
          setSourceId(null);
          return;
        }
        setEmbedPath(`${data.embedUrl}${data.embedUrl.includes("?") ? "&" : "?"}_r=${Date.now()}`);
        setSourceLabel(data.label || data.source || null);
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
  }, [open, mediaId, mediaType, title, year, season, episode, isAnime]);

  // Preview timer
  useEffect(() => {
    if (!open || unlimited) {
      setPaywall(false);
      setRemainingSec(null);
      return;
    }

    usedMsRef.current = readPreviewMs(userId);
    if (usedMsRef.current >= previewLimitMs) {
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
      const left = Math.max(0, previewLimitMs - elapsed);
      setRemainingSec(Math.ceil(left / 1000));
      if (elapsed >= previewLimitMs) {
        setPaywall(true);
        setRemainingSec(0);
        window.clearInterval(tick);
      }
    }, 1000);

    setRemainingSec(Math.ceil((previewLimitMs - base) / 1000));

    return () => {
      window.clearInterval(tick);
      const finalMs = base + (Date.now() - started);
      usedMsRef.current = Math.min(finalMs, previewLimitMs);
      writePreviewMs(userId, usedMsRef.current);
    };
  }, [open, unlimited, userId, previewLimitMs]);

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

  const mins = remainingSec != null ? Math.floor(remainingSec / 60) : 0;
  const secs = remainingSec != null ? remainingSec % 60 : 0;
  const showPlayer = Boolean(embedPath) && !paywall && !resolving && !resolveError;

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
        {sourceLabel && showPlayer && (
          <span className="rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-neutral-200 backdrop-blur-sm">
            {sourceLabel}
          </span>
        )}
        {notice && showPlayer && (
          <span className="max-w-[260px] rounded bg-black/70 px-3 py-1.5 text-right text-xs font-medium text-amber-200 backdrop-blur-sm">
            {notice}
          </span>
        )}
        {!unlimited && remainingSec != null && !paywall && (
          <div className="rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-amber-200 backdrop-blur-sm">
            Prueba {mins}:{String(secs).padStart(2, "0")}
          </div>
        )}
      </div>

      {paywall ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-300">
            {APP_NAME}
          </p>
          <h2 className="max-w-md text-2xl font-black text-white md:text-3xl">
            Se acabó tu preview de prueba
          </h2>
          <p className="max-w-sm text-sm text-neutral-300">
            Activa la membresía mensual por ${price} CLP y mira sin límites
            películas, series y animes.
          </p>
          <Link
            href="/membresia"
            data-tv-focus
            data-tv-autofocus
            className="brand-button tv-cta rounded-xl px-6 py-3 text-base font-bold transition"
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
      ) : resolving ? (
        <div className="flex h-full items-center justify-center text-neutral-300">
          Buscando fuente…
        </div>
      ) : resolveError || !embedPath ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold text-white">
            {resolveError ||
              "Este título todavía no está disponible en ninguna fuente."}
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
