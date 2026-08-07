"use client";

import { useEffect, useRef, useState } from "react";

/**
 * <video> para streams propios (p. ej. proxy Drive).
 * Retoma desde `startAtSeconds` al cargar (progreso guardado).
 */
export default function NativeVideoPlayer({
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
  const [error, setError] = useState("");
  const [resumedHint, setResumedHint] = useState("");
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const startAtRef = useRef(startAtSeconds);
  startAtRef.current = startAtSeconds;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError("");
    setResumedHint("");
    let cancelled = false;
    let didSeek = false;
    let lastSent = 0;

    const absolute = src.startsWith("http")
      ? src
      : new URL(src, window.location.origin).href;

    void (async () => {
      try {
        const probe = await fetch(absolute, {
          method: "GET",
          headers: { Range: "bytes=0-1" },
          credentials: "same-origin",
          cache: "no-store",
        });
        const ct = (probe.headers.get("content-type") || "").toLowerCase();
        if (!probe.ok && probe.status !== 206) {
          const data = await probe.json().catch(() => null);
          if (!cancelled) {
            setError(
              (data && data.error) ||
                `No se pudo cargar el video (${probe.status}).`
            );
          }
          return;
        }
        if (ct.includes("application/json") || ct.includes("text/html")) {
          const data = await probe.json().catch(async () => {
            const t = await probe.text();
            return { error: t.slice(0, 200) };
          });
          if (!cancelled) {
            setError(
              (data && data.error) ||
                "El servidor no devolvió un archivo de video."
            );
          }
          return;
        }

        if (!cancelled) {
          await probe.body?.cancel().catch(() => undefined);
          video.src = absolute;
          void video.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) setError("Error de red al cargar el video.");
      }
    })();

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

    const onErr = () => {
      setError((prev) =>
        prev
          ? prev
          : "El navegador no pudo reproducir este archivo. Usa MP4 (H.264) público en Drive."
      );
    };
    const onEnded = () =>
      onProgressRef.current?.(100, true, Math.floor(video.duration || 0));
    const onPause = () => emit(true);
    const onVis = () => {
      if (document.visibilityState === "hidden") emit(true);
    };
    const onTime = () => emit(false);

    video.addEventListener("error", onErr);
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
      video.removeEventListener("error", onErr);
      video.removeEventListener("loadedmetadata", trySeek);
      video.removeEventListener("durationchange", trySeek);
      video.removeEventListener("canplay", trySeek);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVis);
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-6 text-center">
        <p className="text-sm font-medium text-red-300">{error}</p>
        <p className="max-w-md text-xs text-white/45">
          Drive debe estar en “Cualquiera con el enlace”. En Coolify puedes
          añadir <code className="text-cyan-200/80">GOOGLE_DRIVE_API_KEY</code>{" "}
          (API key de Google Cloud con Drive API) para más fiabilidad.
        </p>
      </div>
    );
  }

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
