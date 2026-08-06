"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

/** Reproduce HLS (AnimeAV1/Zilla o Pluto vía proxy) en un <video> nativo. */
export default function HlsVideoPlayer({
  src,
  title,
  onProgress,
}: {
  src: string;
  title: string;
  onProgress?: (progressPct: number, completed: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    const absolute = src.startsWith("http")
      ? src
      : new URL(src, window.location.origin).href;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        xhrSetup(xhr) {
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(absolute);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = absolute;
      void video.play().catch(() => undefined);
    } else {
      video.src = absolute;
    }

    let lastSent = 0;
    const emit = () => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const pct = Math.min(100, Math.round((video.currentTime / dur) * 100));
      const completed = pct >= 90;
      const now = Date.now();
      if (now - lastSent < 12_000 && !completed) return;
      lastSent = now;
      onProgressRef.current?.(completed ? 100 : Math.max(5, pct), completed);
    };

    video.addEventListener("timeupdate", emit);
    video.addEventListener("ended", () => {
      onProgressRef.current?.(100, true);
    });

    return () => {
      video.removeEventListener("timeupdate", emit);
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      controls
      playsInline
      autoPlay
      title={title}
    />
  );
}
