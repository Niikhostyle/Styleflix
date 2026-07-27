/**
 * Google Ad Manager + IMA (video pre-roll VAST)
 * =================================================
 *
 * SETUP EN GOOGLE AD MANAGER (https://admanager.google.com):
 * 1. Inventario → Unidades de anuncio → Nueva unidad de video
 * 2. Generar etiqueta → Tipo: Google IMA SDK / VAST
 * 3. Copia la URL del tag (pubads.g.doubleclick.net/gampad/ads?iu=/XXXX/...)
 * 4. Pégala en NEXT_PUBLIC_GAM_VAST_TAG
 * 5. Vincula AdSense / pagos en Ad Manager para cobrar
 *
 * DESARROLLO: NEXT_PUBLIC_GAM_VAST_TEST=1 usa un tag de muestra (NO paga).
 *
 * DISPLAY (opcional): AdSense banners con NEXT_PUBLIC_ADSENSE_*
 */

export type PrerollConfig = {
  enabled: boolean;
  mode: "gam" | "house" | "off";
  videoUrl: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  skipAfterSec: number;
  advertiser: string;
  vastTag: string | null;
  /** Permitir botón “Omitir” manual (solo test / fallback). */
  allowForceSkip: boolean;
  /** Segundos máximos esperando fill; si no hay ad → contenido. */
  loadTimeoutSec: number;
};

// Re-export AdSense para imports antiguos
export { getAdSenseConfig, type AdSenseConfig } from "./adsense";

/** Tag VAST de prueba de Google (single linear). NO genera ingresos. */
export const GAM_VAST_TEST_TAG =
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";

function resolveVastTag(): string | null {
  const real =
    process.env.NEXT_PUBLIC_GAM_VAST_TAG?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_VAST_TAG?.trim() ||
    null;
  if (real) return real;

  const useTest =
    process.env.NEXT_PUBLIC_GAM_VAST_TEST === "1" ||
    process.env.NEXT_PUBLIC_GOOGLE_VAST_TEST === "1";
  return useTest ? GAM_VAST_TEST_TAG : null;
}

export function buildVastUrl(tag: string): string {
  const correlator = String(Date.now());
  if (/[?&]correlator=/i.test(tag)) {
    return tag.replace(/([?&]correlator=)[^&]*/i, `$1${correlator}`);
  }
  return `${tag}${tag.includes("?") ? "&" : "?"}correlator=${correlator}`;
}

export function getPrerollConfig(): PrerollConfig {
  const enabled = process.env.NEXT_PUBLIC_PREROLL_ENABLED !== "0";
  const vastTag = resolveVastTag();
  const videoUrl = process.env.NEXT_PUBLIC_PREROLL_VIDEO_URL?.trim() || null;
  const imageUrl = process.env.NEXT_PUBLIC_PREROLL_IMAGE_URL?.trim() || null;
  const clickUrl = process.env.NEXT_PUBLIC_PREROLL_CLICK_URL?.trim() || null;
  const skipRaw = Number(process.env.NEXT_PUBLIC_PREROLL_SKIP_AFTER ?? "5");
  const skipAfterSec = Number.isFinite(skipRaw)
    ? Math.min(30, Math.max(0, skipRaw))
    : 5;
  const timeoutRaw = Number(process.env.NEXT_PUBLIC_GAM_LOAD_TIMEOUT ?? "10");
  const loadTimeoutSec = Number.isFinite(timeoutRaw)
    ? Math.min(30, Math.max(3, timeoutRaw))
    : 10;
  const advertiser =
    process.env.NEXT_PUBLIC_PREROLL_ADVERTISER?.trim() || "Google Ad Manager";

  // En test permitimos omitir; en producción el skip lo controla el propio VAST
  const isTestTag = Boolean(
    vastTag &&
      (vastTag.includes("/21775744923/external/") ||
        process.env.NEXT_PUBLIC_GAM_VAST_TEST === "1" ||
        process.env.NEXT_PUBLIC_GOOGLE_VAST_TEST === "1")
  );
  const allowForceSkip =
    process.env.NEXT_PUBLIC_GAM_ALLOW_FORCE_SKIP === "1" || isTestTag;

  let mode: PrerollConfig["mode"] = "off";
  if (enabled && vastTag) mode = "gam";
  else if (enabled && (videoUrl || imageUrl)) mode = "house";
  else if (enabled && !vastTag) {
    // Pre-roll pedido pero sin tag: modo house demo / o off
    mode = "house";
  }

  return {
    enabled: mode !== "off",
    mode,
    videoUrl,
    imageUrl,
    clickUrl,
    skipAfterSec,
    advertiser,
    vastTag,
    allowForceSkip,
    loadTimeoutSec,
  };
}

export function hasPrerollCreative(cfg: PrerollConfig) {
  return Boolean(cfg.vastTag || cfg.videoUrl || cfg.imageUrl);
}
