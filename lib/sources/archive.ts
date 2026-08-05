/**
 * Archive.org — cine de dominio público con stream directo y legal.
 * Sirve para dos cosas: aportar filas de clásicos al catálogo y actuar como
 * última fuente de reproducción cuando ni Vimeus ni Pluto TV tienen el título.
 */

import { findTmdbMatch, type MediaType } from "@/lib/tmdb";
import { mapWithConcurrency, normalizeTitle, scoreTitleMatch, yearFrom } from "@/lib/sources/match";
import { toCatalogItem, type CatalogItem } from "@/lib/sources/types";

const SEARCH_URL = "https://archive.org/advancedsearch.php";
const EMBED_BASE = "https://archive.org/embed";
const MATCH_CONCURRENCY = 5;
const ROW_SIZE = 24;

export type ArchiveMatch = {
  identifier: string;
  title: string;
  year: number | null;
  embedUrl: string;
};

type ArchiveDoc = {
  identifier?: string;
  title?: string | string[];
  year?: string | number | null;
};

function docTitle(doc: ArchiveDoc): string {
  if (Array.isArray(doc.title)) return doc.title[0] ?? "";
  return doc.title ?? "";
}

function toArchiveMatch(doc: ArchiveDoc): ArchiveMatch | null {
  const identifier = doc.identifier?.trim();
  const title = docTitle(doc).trim();
  if (!identifier || !title) return null;

  return {
    identifier,
    title,
    year: yearFrom(doc.year ?? null),
    embedUrl: `${EMBED_BASE}/${encodeURIComponent(identifier)}`,
  };
}

async function archiveSearch(
  query: string,
  rows: number,
  revalidate: number
): Promise<ArchiveMatch[]> {
  const params = new URLSearchParams({
    q: query,
    rows: String(rows),
    page: "1",
    output: "json",
  });
  // `fl[]` se repite, así que no puede ir en el objeto inicial.
  params.append("fl[]", "identifier");
  params.append("fl[]", "title");
  params.append("fl[]", "year");

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags: ["archive"] },
  });

  if (!res.ok) {
    throw new Error(`Archive.org ${res.status}`);
  }

  const payload = (await res.json()) as {
    response?: { docs?: ArchiveDoc[] };
  };
  const docs = payload.response?.docs ?? [];
  return docs
    .map(toArchiveMatch)
    .filter((m): m is ArchiveMatch => m !== null);
}

async function toCatalogItems(
  matches: ArchiveMatch[],
  mediaType: MediaType
): Promise<CatalogItem[]> {
  const mapped = await mapWithConcurrency(
    matches,
    MATCH_CONCURRENCY,
    async (entry) => {
      try {
        const match = await findTmdbMatch({
          title: entry.title,
          mediaType,
          year: entry.year,
        });
        return match ? toCatalogItem(match, "archive", true) : null;
      } catch {
        return null;
      }
    }
  );

  return mapped.filter((item): item is CatalogItem => item !== null);
}

const COLLECTIONS: { title: string; collection: string }[] = [
  { title: "Clásicos de dominio público", collection: "feature_films" },
  { title: "Cine negro", collection: "film_noir" },
  { title: "Ciencia ficción y terror clásico", collection: "sci-fi_horror" },
  { title: "Seriales de aventuras", collection: "serials" },
];

/**
 * Archive.org también aloja subidas de usuarios con copyright vigente.
 * Toda búsqueda queda restringida a estas colecciones curadas de dominio
 * público para no acabar sirviendo material infractor.
 */
const PUBLIC_DOMAIN_FILTER = `collection:(${COLLECTIONS.map((c) => c.collection).join(" OR ")})`;

async function loadCollection(title: string, collection: string) {
  try {
    const matches = await archiveSearch(
      `collection:(${collection}) AND mediatype:(movies)`,
      ROW_SIZE,
      86400
    );
    return {
      title,
      mediaType: "movie" as MediaType,
      items: await toCatalogItems(matches, "movie"),
    };
  } catch (err) {
    console.error(`[archive] colección "${collection}" falló`, err);
    return { title, mediaType: "movie" as MediaType, items: [] };
  }
}

export async function getArchiveRows() {
  return Promise.all(
    COLLECTIONS.map((c) => loadCollection(c.title, c.collection))
  );
}

export async function getArchiveMovies(): Promise<CatalogItem[]> {
  const rows = await getArchiveRows();
  return rows.flatMap((row) => row.items);
}

/**
 * Busca un título concreto en Archive.org para reproducirlo.
 * Solo acepta coincidencias fuertes: aquí un falso positivo significa poner
 * al usuario una película equivocada.
 */
export async function findArchiveMatch(opts: {
  title: string;
  year?: number | null;
}): Promise<ArchiveMatch | null> {
  const queryNorm = normalizeTitle(opts.title);
  if (!queryNorm) return null;

  const escaped = opts.title.replace(/["\\]/g, " ").trim();
  if (!escaped) return null;

  try {
    const candidates = await archiveSearch(
      `title:("${escaped}") AND mediatype:(movies) AND ${PUBLIC_DOMAIN_FILTER}`,
      20,
      21600
    );

    let best: ArchiveMatch | null = null;
    let bestScore = 85; // umbral alto: exigimos título casi exacto

    for (const candidate of candidates) {
      const score = scoreTitleMatch(candidate.title, queryNorm, {
        candidateYear: candidate.year,
        queryYear: opts.year ?? null,
      });
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  } catch (err) {
    console.error("[archive] búsqueda falló", err);
    return null;
  }
}
