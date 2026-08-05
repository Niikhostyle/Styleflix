/** Marca visible en web y apps. */
export const APP_NAME = "VeoTV";
export const APP_NAME_UPPER = "VeoTV";
export const APP_TAGLINE =
  "Películas, series y animes. Tu plataforma de streaming.";

/** Fallback si no carga settings de DB. Preview desactivado. */
export const DEFAULT_PREVIEW_MINUTES = 0;

export function previewStorageKey(userId: string) {
  return `veotv_preview_ms_${userId}`;
}
