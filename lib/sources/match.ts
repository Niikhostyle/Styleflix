/**
 * Utilidades compartidas por las fuentes de catálogo: normalización de títulos,
 * puntuación de coincidencias y control de concurrencia para no saturar APIs.
 */

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Puntúa qué tan bien coincide un candidato con la búsqueda.
 * Devuelve -1 cuando no hay coincidencia utilizable.
 */
export function scoreTitleMatch(
  candidate: string,
  queryNorm: string,
  opts?: { candidateYear?: number | null; queryYear?: number | null }
): number {
  const candidateNorm = normalizeTitle(candidate);
  if (!queryNorm || !candidateNorm) return -1;

  let score = 0;
  if (candidateNorm === queryNorm) {
    score += 100;
  } else if (
    candidateNorm.includes(queryNorm) ||
    queryNorm.includes(candidateNorm)
  ) {
    score += 60;
  } else {
    const words = queryNorm.split(" ").filter((w) => w.length > 2);
    const hits = words.filter((w) => candidateNorm.includes(w)).length;
    if (hits === 0) return -1;
    score += hits * 12;
  }

  const { candidateYear, queryYear } = opts ?? {};
  if (queryYear && candidateYear) {
    if (candidateYear === queryYear) score += 40;
    else if (Math.abs(candidateYear - queryYear) <= 1) score += 10;
    else score -= 25;
  }

  return score;
}

/**
 * Recorre una lista con un límite de peticiones simultáneas.
 * Jikan permite ~3 req/s y TMDB castiga ráfagas, así que nunca lanzamos
 * decenas de fetch en paralelo.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    })()
  );

  await Promise.all(runners);
  return results;
}

/**
 * Ejecuta una promesa con tope de tiempo y valor de reserva.
 * Una fuente lenta o caída no debe dejar el catálogo entero colgado: la fila
 * aparece vacía y se rellena cuando la caché se caliente.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[sources] ${label} superó ${ms}ms; se omite por ahora`);
      resolve(fallback);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (err) {
    console.error(`[sources] ${label} falló`, err);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Año a partir de una fecha TMDB (`2024-05-01`) o de un texto libre. */
export function yearFrom(value?: string | number | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return value >= 1870 && value <= 2100 ? value : null;
  }
  const match = value.match(/(?:19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1870 && year <= 2100 ? year : null;
}
