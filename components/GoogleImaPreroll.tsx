"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { buildVastUrl } from "@/lib/ads";

type Props = {
  vastTag: string;
  allowForceSkip?: boolean;
  loadTimeoutSec?: number;
  onDone: () => void;
};

type ImaAdsManager = {
  init: (w: number, h: number, viewMode: unknown) => void;
  start: () => void;
  resize: (w: number, h: number, viewMode: unknown) => void;
  destroy: () => void;
  getAdSkippableState?: () => boolean;
  skip?: () => void;
  addEventListener: (
    type: string,
    fn: (e?: { getError?: () => { getMessage?: () => string } }) => void
  ) => void;
};

type ImaNamespace = {
  settings: {
    setLocale: (locale: string) => void;
    setDisableCustomPlaybackForIOS10Plus: (v: boolean) => void;
  };
  AdDisplayContainer: new (
    container: HTMLElement,
    video?: HTMLVideoElement
  ) => { initialize: () => void; destroy?: () => void };
  AdsLoader: new (container: {
    initialize: () => void;
  }) => {
    addEventListener: (type: string, fn: (e: unknown) => void) => void;
    requestAds: (req: unknown) => void;
    contentComplete: () => void;
  };
  AdsRequest: new () => {
    adTagUrl: string;
    linearAdSlotWidth: number;
    linearAdSlotHeight: number;
    nonLinearAdSlotWidth: number;
    nonLinearAdSlotHeight: number;
    setAdWillAutoPlay: (v: boolean) => void;
    setAdWillPlayMuted: (v: boolean) => void;
  };
  AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
  AdErrorEvent: { Type: { AD_ERROR: string } };
  AdEvent: { Type: Record<string, string> };
  ViewMode: { NORMAL: unknown };
};

declare global {
  interface Window {
    google?: { ima?: ImaNamespace };
  }
}

function track(event: string, extra?: Record<string, unknown>) {
  void fetch("/api/ads/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      advertiser: "Google Ad Manager",
      ...extra,
    }),
  }).catch(() => {});
}

/**
 * Pre-roll oficial: Google Ad Manager (VAST) + IMA HTML5 SDK.
 * Debe montarse tras un gesto del usuario (clic en Reproducir).
 */
export default function GoogleImaPreroll({
  vastTag,
  allowForceSkip = false,
  loadTimeoutSec = 10,
  onDone,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adsManagerRef = useRef<ImaAdsManager | null>(null);
  const displayContainerRef = useRef<{ destroy?: () => void } | null>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);

  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.google?.ima)
  );
  const [status, setStatus] = useState("Conectando con Ad Manager…");
  const [canForceSkip, setCanForceSkip] = useState(false);

  const finish = useCallback(
    (reason: "complete" | "skip" | "error" | "timeout" | "empty") => {
      if (doneRef.current) return;
      doneRef.current = true;
      track(reason === "complete" ? "complete" : reason);
      try {
        adsManagerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      try {
        displayContainerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      adsManagerRef.current = null;
      onDone();
    },
    [onDone]
  );

  useEffect(() => {
    if (!allowForceSkip) return;
    const t = window.setTimeout(() => setCanForceSkip(true), 5000);
    return () => window.clearTimeout(t);
  }, [allowForceSkip]);

  useEffect(() => {
    if (!scriptReady || startedRef.current) return;
    const ima = window.google?.ima;
    const adContainer = adContainerRef.current;
    const video = videoRef.current;
    if (!ima || !adContainer || !video) return;

    startedRef.current = true;
    doneRef.current = false;

    const loadTimer = window.setTimeout(() => {
      if (!doneRef.current) {
        setStatus("Sin anuncio · continuando…");
        finish("timeout");
      }
    }, loadTimeoutSec * 1000);

    try {
      ima.settings.setLocale("es");
      ima.settings.setDisableCustomPlaybackForIOS10Plus(true);

      const adDisplayContainer = new ima.AdDisplayContainer(adContainer, video);
      displayContainerRef.current = adDisplayContainer;
      // Requiere gesto de usuario (ya venimos del clic en portada)
      adDisplayContainer.initialize();

      const adsLoader = new ima.AdsLoader(adDisplayContainer);

      adsLoader.addEventListener(
        ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (eventUnknown) => {
          window.clearTimeout(loadTimer);
          const event = eventUnknown as {
            getAdsManager: (
              v: HTMLVideoElement,
              renderingSettings?: unknown
            ) => ImaAdsManager;
          };

          try {
            const adsManager = event.getAdsManager(video);
            adsManagerRef.current = adsManager;

            const onAdError = () => {
              setStatus("Error de anuncio · continuando…");
              finish("error");
            };

            adsManager.addEventListener(ima.AdEvent.Type.LOADED, () => {
              setStatus("Anuncio · Google Ad Manager");
              track("impression");
            });
            adsManager.addEventListener(ima.AdEvent.Type.STARTED, () => {
              setStatus("Anuncio");
            });
            adsManager.addEventListener(ima.AdEvent.Type.COMPLETE, () =>
              finish("complete")
            );
            adsManager.addEventListener(ima.AdEvent.Type.SKIPPED, () =>
              finish("skip")
            );
            adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () =>
              finish("complete")
            );
            adsManager.addEventListener(ima.AdEvent.Type.USER_CLOSE, () =>
              finish("skip")
            );
            adsManager.addEventListener(
              ima.AdErrorEvent.Type.AD_ERROR,
              onAdError
            );

            const w = rootRef.current?.clientWidth || window.innerWidth;
            const h = rootRef.current?.clientHeight || window.innerHeight;
            video.volume = 1;
            video.muted = false;

            adsManager.init(w, h, ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (err) {
            console.warn("[IMA] adsManager init failed", err);
            finish("error");
          }
        }
      );

      adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (e) => {
        window.clearTimeout(loadTimer);
        const msg =
          (
            e as { getError?: () => { getMessage?: () => string } }
          ).getError?.()?.getMessage?.() || "empty";
        console.warn("[IMA] ad error", msg);
        setStatus("Sin fill · reproduciendo contenido…");
        finish("empty");
      });

      const request = new ima.AdsRequest();
      request.adTagUrl = buildVastUrl(vastTag);
      const w = rootRef.current?.clientWidth || 1280;
      const h = rootRef.current?.clientHeight || 720;
      request.linearAdSlotWidth = w;
      request.linearAdSlotHeight = h;
      request.nonLinearAdSlotWidth = w;
      request.nonLinearAdSlotHeight = Math.min(150, Math.floor(h / 4));
      request.setAdWillAutoPlay(true);
      // Tras clic del usuario podemos pedir con sonido
      request.setAdWillPlayMuted(false);

      setStatus("Solicitando anuncio VAST…");
      adsLoader.requestAds(request);
    } catch (err) {
      window.clearTimeout(loadTimer);
      console.warn("[IMA] setup failed", err);
      finish("error");
    }

    const onResize = () => {
      const root = rootRef.current;
      const mgr = adsManagerRef.current;
      const imaNs = window.google?.ima;
      if (!root || !mgr || !imaNs) return;
      try {
        mgr.resize(root.clientWidth, root.clientHeight, imaNs.ViewMode.NORMAL);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("resize", onResize);
      try {
        adsManagerRef.current?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [scriptReady, vastTag, loadTimeoutSec, finish]);

  return (
    <div ref={rootRef} className="absolute inset-0 z-30 bg-black">
      <Script
        id="google-ima-sdk"
        src="https://imasdk.googleapis.com/js/sdkloader/ima3.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => finish("error")}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent px-4 py-3 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          {status}
        </p>
        {allowForceSkip && canForceSkip && (
          <button
            type="button"
            onClick={() => finish("skip")}
            className="pointer-events-auto rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Omitir (test)
          </button>
        )}
      </div>

      {/* Contenedor IMA: el SDK inyecta el anuncio aquí */}
      <div ref={adContainerRef} className="absolute inset-0">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          playsInline
          preload="auto"
        />
      </div>

      <p className="pointer-events-none absolute bottom-4 left-4 z-10 text-[11px] text-neutral-600">
        Google Ad Manager · IMA / VAST
      </p>
    </div>
  );
}
