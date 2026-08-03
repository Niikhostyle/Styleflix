import type { MediaType } from "@/lib/tmdb";

const BASE = "https://vimeus.com";

/**
 * URL de embed Web (view_key). La API Key NUNCA debe usarse en el cliente.
 */
export function getVimeusEmbedUrl(
  mediaType: MediaType,
  tmdbId: number,
  opts?: { season?: number; episode?: number; anime?: boolean }
): string {
  const viewKey = process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY;
  if (!viewKey) {
    throw new Error("Falta NEXT_PUBLIC_VIMEUS_VIEW_KEY");
  }

  const params = new URLSearchParams({
    tmdb: String(tmdbId),
    view_key: viewKey,
    // Parámetros recomendados por el generador de Vimeus
    loader: "v3",
    overlay: "v5",
    playUI: "v2",
    splash: "v2",
    autoplay: "1",
  });

  if (opts?.season != null) params.set("se", String(opts.season));
  if (opts?.episode != null) params.set("ep", String(opts.episode));

  let path: string;
  if (opts?.anime) {
    path = "/e/anime";
  } else if (mediaType === "tv") {
    path = "/e/serie";
  } else {
    path = "/e/movie";
  }

  return `${BASE}${path}?${params.toString()}`;
}

/** Listados del servidor (requiere VIMEUS_API_KEY). */
export async function vimeusList(
  kind: "movies" | "series" | "animes" | "episodes",
  page = 1,
  extra?: { tmdb_id?: number; season?: number }
) {
  const apiKey = process.env.VIMEUS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta VIMEUS_API_KEY");
  }

  const params = new URLSearchParams({ page: String(page) });
  if (extra?.tmdb_id != null) params.set("tmdb_id", String(extra.tmdb_id));
  if (extra?.season != null) params.set("season", String(extra.season));

  const res = await fetch(`${BASE}/api/listing/${kind}?${params}`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Vimeus listing error: ${res.status}`);
  }

  return res.json();
}
