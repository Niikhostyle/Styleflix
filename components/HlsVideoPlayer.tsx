"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/** Reproduce HLS (AnimeAV1/Zilla o Pluto vía proxy) en un <video> nativo. */
export default function HlsVideoPlayer({
  src,
  title,
  startAtSeconds = 0,
  onProgress,
}: {
  src: string;
  title: string;
  startAtSeconds?: number;
  onProgress?: (
    progressPct: number,
    completed: boolean,
    positionSeconds: number
  ) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const startAtRef = useRef(startAtSeconds);
  startAtRef.current = startAtSeconds;
  const [resumedHint, setResumedHint] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let cancelled = false;
    let didSeek = false;
    let lastSent = 0;
    setResumedHint("");

    const absolute = src.startsWith("http")
      ? src
      : new URL(src, window.location.origin).href;

    const trySeek = () => {
      if (didSeek || cancelled) return;
      const want = startAtRef.current;
      const dur = video.duration;
      if (!want || want < 5) return;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (want / dur >= 0.92) return;
      const target = Math.min(want, Math.max(0, dur - 3));
      try {
        video.currentTime = target;
        didSeek = true;
        const m = Math.floor(target / 60);
        const s = Math.floor(target % 60);
        setResumedHint(`Retomando desde ${m}:${String(s).padStart(2, "0")}`);
        window.setTimeout(() => {
          if (!cancelled) setResumedHint("");
        }, 3500);
      } catch {
        /* ignore */
      }
    };

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
      hls.on(Hls.Events.LEVEL_LOADED, trySeek);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = absolute;
      void video.play().catch(() => undefined);
    } else {
      video.src = absolute;
    }

    const emit = (force = false) => {
      const dur = video.duration;
      const t = video.currentTime;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (!Number.isFinite(t) || t < 0) return;
      const pct = Math.min(100, Math.round((t / dur) * 100));
      const completed = pct >= 92;
      const now = Date.now();
      if (!force && now - lastSent < 8_000 && !completed) return;
      lastSent = now;
      onProgressRef.current?.(
        completed ? 100 : Math.max(1, pct),
        completed,
        Math.floor(t)
      );
    };

    const onTime = () => emit(false);
    const onPause = () => emit(true);
    const onEnded = () =>
      onProgressRef.current?.(100, true, Math.floor(video.duration || 0));
    const onVis = () => {
      if (document.visibilityState === "hidden") emit(true);
    };

    video.addEventListener("loadedmetadata", trySeek);
    video.addEventListener("durationchange", trySeek);
    video.addEventListener("canplay", trySeek);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      emit(true);
      video.removeEventListener("loadedmetadata", trySeek);
      video.removeEventListener("durationchange", trySeek);
      video.removeEventListener("canplay", trySeek);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVis);
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        controls
        playsInline
        autoPlay
        title={title}
      />
      {resumedHint ? (
        <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
          {resumedHint}
        </div>
      ) : null}
    </>
  );
}
