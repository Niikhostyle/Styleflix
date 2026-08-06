"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

/** Reproduce HLS (AnimeAV1/Zilla o Pluto vía proxy) en un <video> nativo. */
export default function HlsVideoPlayer({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    const absolute = src.startsWith("http")
      ? src
      : new URL(src, window.location.origin).href;

    // Preferir hls.js: Safari nativo falla a menudo con segs .html de Zilla.
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

    return () => {
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
