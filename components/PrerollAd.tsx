"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { PrerollConfig } from "@/lib/ads";

type Props = {
  config: PrerollConfig;
  mediaId: number;
  mediaType: string;
  title: string;
  onDone: () => void;
};

function track(event: string, payload: Record<string, unknown>) {
  void fetch("/api/ads/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => {});
}

export default function PrerollAd({
  config,
  mediaId,
  mediaType,
  title,
  onDone,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [canSkip, setCanSkip] = useState(config.skipAfterSec <= 0);
  const startedRef = useRef(false);

  const hasVideo = Boolean(config.videoUrl);
  const hasImage = Boolean(config.imageUrl);
  const durationHint = hasVideo ? null : Math.max(config.skipAfterSec, 8);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("impression", {
      mediaId,
      mediaType,
      title,
      advertiser: config.advertiser,
    });
  }, [mediaId, mediaType, title, config.advertiser]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (elapsed >= config.skipAfterSec) setCanSkip(true);
  }, [elapsed, config.skipAfterSec]);

  // Anuncio sin video: avanza solo al cumplir el tiempo mínimo
  useEffect(() => {
    if (hasVideo) return;
    const wait = durationHint ?? 8;
    if (elapsed >= wait) onDone();
  }, [elapsed, hasVideo, durationHint, onDone]);

  const finish = (reason: "complete" | "skip") => {
    track(reason, { mediaId, mediaType, title, advertiser: config.advertiser });
    onDone();
  };

  const openClick = () => {
    if (!config.clickUrl) return;
    track("click", {
      mediaId,
      mediaType,
      title,
      advertiser: config.advertiser,
      url: config.clickUrl,
    });
    window.open(config.clickUrl, "_blank", "noopener,noreferrer");
  };

  const skipLeft = Math.max(0, config.skipAfterSec - elapsed);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-3 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Anuncio · {config.advertiser}
        </p>
        <button
          type="button"
          disabled={!canSkip}
          onClick={() => finish("skip")}
          className="rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition enabled:hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {canSkip ? "Omitir anuncio" : `Omitir en ${skipLeft}s`}
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {hasVideo && (
          <video
            ref={videoRef}
            src={config.videoUrl!}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            autoPlay
            playsInline
            muted={false}
            controls={false}
            onEnded={() => finish("complete")}
            onError={() => finish("complete")}
          />
        )}

        {!hasVideo && hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.imageUrl!}
            alt={config.advertiser}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {!hasVideo && !hasImage && (
          <div className="px-6 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[#E50914]">
              StyleFlix Ads
            </p>
            <p className="mt-3 text-2xl font-bold text-white md:text-4xl">
              {config.advertiser}
            </p>
            <p className="mt-2 max-w-md text-sm text-neutral-400">
              Espacio publicitario. Configura{" "}
              <code className="text-neutral-300">NEXT_PUBLIC_PREROLL_VIDEO_URL</code>{" "}
              para tu creativo.
            </p>
            <p className="mt-6 text-neutral-500">
              El contenido empieza en{" "}
              {Math.max(0, (durationHint ?? 8) - elapsed)}s
            </p>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-4 py-4 md:px-8">
        <p className="text-xs text-neutral-500">Tu anuncio · antes de Vimeus</p>
        {config.clickUrl && (
          <button
            type="button"
            onClick={openClick}
            className="flex items-center gap-2 rounded bg-[#E50914] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#f6121d]"
          >
            Más info
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
