/** Fallback si no hay setting (30 min). */
export const DEFAULT_DEMO_CATALOG_MINUTES = 30;

const MIN_DEMO_MINUTES = 0;
const MAX_DEMO_MINUTES = 30 * 24 * 60; // 30 días

export function clampDemoMinutes(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEMO_CATALOG_MINUTES;
  return Math.min(MAX_DEMO_MINUTES, Math.max(MIN_DEMO_MINUTES, Math.round(n)));
}

/** Etiqueta legible de duración configurada: prioriza días, luego horas. */
export function formatDemoDuration(minutes: number): string {
  const m = clampDemoMinutes(minutes);
  if (m <= 0) return "desactivada";

  const days = Math.floor(m / (24 * 60));
  const afterDays = m % (24 * 60);
  const hours = Math.floor(afterDays / 60);
  const mins = afterDays % 60;

  if (days > 0) {
    const d = `${days} día${days === 1 ? "" : "s"}`;
    if (hours > 0) return `${d} ${hours} h`;
    if (mins > 0) return `${d} ${mins} min`;
    return d;
  }
  if (hours > 0) {
    if (mins > 0) return `${hours} h ${mins} min`;
    return `${hours} h`;
  }
  return `${mins} min`;
}

/**
 * Tiempo restante de demo (ms): días primero; si sobran horas, también horas.
 * Bajo 1 h: minutos:segundos.
 */
export function formatDemoRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  if (totalSec <= 0) return "0 s";

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    const d = `${days} día${days === 1 ? "" : "s"}`;
    if (hours > 0) return `${d} ${hours} h`;
    return d;
  }
  if (hours > 0) {
    if (mins > 0) return `${hours} h ${mins} min`;
    return `${hours} h`;
  }
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }
  return `0:${String(secs).padStart(2, "0")}`;
}
