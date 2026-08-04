/** Marca visible en web y apps. */
export const APP_NAME = "Naseros";
export const APP_NAME_UPPER = "NASEROS";
export const APP_TAGLINE =
  "Películas, series y animes. Tu plataforma de streaming.";

/** Preview gratis sin membresía (ms). */
export const PREVIEW_LIMIT_MS = 5 * 60 * 1000;

export function previewStorageKey(userId: string) {
  return `naseros_preview_ms_${userId}`;
}
