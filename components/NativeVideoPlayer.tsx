"use client";

import { useEffect, useRef, useState } from "react";

/**
 * <video> para streams propios (p. ej. proxy Drive).
 * Si el API devuelve JSON/HTML de error, muestra el mensaje en vez del MIME genérico.
 */
export default function NativeVideoPlayer({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError("");
    const absolute = src.startsWith("http")
      ? src
      : new URL(src, window.location.origin).href;

    let cancelled = false;

    void (async () => {
      try {
        // Probe: primer byte con credentials para capturar 401/502 JSON
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
        if (!cancelled) {
          setError("Error de red al cargar el video.");
        }
      }
    })();

    const onErr = () => {
      setError((prev) =>
        prev
          ? prev
          : "El navegador no pudo reproducir este archivo. Usa MP4 (H.264) público en Drive."
      );
    };
    video.addEventListener("error", onErr);

    return () => {
      cancelled = true;
      video.removeEventListener("error", onErr);
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
