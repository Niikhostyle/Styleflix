import { NextResponse } from "next/server";
import {
  getVimeusEmbedUrl,
  vimeusEmbedHasSources,
  vimeusHasTmdbId,
} from "@/lib/vimeus";
import { findPlutoMatch } from "@/lib/pluto";
import { findArchiveMatch } from "@/lib/sources/archive";
import { isSourceEnabled } from "@/lib/sources/types";
import {
  getBestTrailerKey,
  getMediaDetails,
  getTrailerPlayerUrl,
  type MediaType,
} from "@/lib/tmdb";

/**
 * Resuelve la fuente de reproducción en cascada:
 * Vimeus → Pluto TV → Archive.org → tráiler de TMDB.
 * GET /api/play/resolve?tmdb=&type=movie|tv&title=&year=&se=&ep=&anime=1
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdb = Number(searchParams.get("tmdb"));
  const type = (searchParams.get("type") || "movie") as MediaType;
  const title = (searchParams.get("title") || "").trim();
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  const se = searchParams.get("se");
  const ep = searchParams.get("ep");
  const anime = searchParams.get("anime") === "1";

  if (!Number.isFinite(tmdb) || tmdb <= 0 || (type !== "movie" && type !== "tv")) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  const safeYear = Number.isFinite(year as number) ? year : null;
  const season = se != null ? Number(se) : type === "tv" ? 1 : undefined;
  const episode = ep != null ? Number(ep) : type === "tv" ? 1 : undefined;
  const vimeusOpts = {
    season: type === "tv" ? season : undefined,
    episode: type === "tv" ? episode : undefined,
    anime: type === "tv" ? anime : undefined,
  };

  try {
    if (isSourceEnabled("vimeus")) {
      let vimeusOk = await vimeusHasTmdbId(type, tmdb, { anime });
      if (!vimeusOk) {
        vimeusOk = await vimeusEmbedHasSources(type, tmdb, vimeusOpts);
      }

      if (vimeusOk && process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY) {
        return NextResponse.json({
          source: "vimeus",
          label: "Vimeus",
          embedUrl: getVimeusEmbedUrl(type, tmdb, vimeusOpts),
        });
      }
    }

    if (title && isSourceEnabled("pluto")) {
      const pluto = await findPlutoMatch({
        title,
        mediaType: type,
        year: safeYear,
      });
      if (pluto) {
        return NextResponse.json({
          source: "pluto",
          label: "Pluto TV",
          embedUrl: pluto.watchUrl,
          pluto: {
            id: pluto.id,
            slug: pluto.slug,
            name: pluto.name,
            type: pluto.type,
          },
        });
      }
    }

    // Archive.org solo tiene largometrajes de dominio público.
    if (title && type === "movie" && isSourceEnabled("archive")) {
      const archive = await findArchiveMatch({ title, year: safeYear });
      if (archive) {
        return NextResponse.json({
          source: "archive",
          label: "Archive.org",
          embedUrl: archive.embedUrl,
          archive: { identifier: archive.identifier },
        });
      }
    }

    // Sin stream: ofrecemos el tráiler para no dejar al usuario sin nada.
    const trailerKey = await getMediaDetails(type, tmdb)
      .then(getBestTrailerKey)
      .catch(() => null);

    if (trailerKey) {
      return NextResponse.json({
        source: "trailer",
        label: "Tráiler",
        embedUrl: getTrailerPlayerUrl(trailerKey),
        fallback: true,
        notice: "Aún no hay stream de este título. Te mostramos el tráiler.",
      });
    }

    return NextResponse.json(
      {
        error: "Este título todavía no está disponible en ninguna fuente.",
        source: null,
      },
      { status: 404 }
    );
  } catch (err) {
    console.error("[play/resolve]", err);
    return NextResponse.json(
      { error: "No se pudo resolver la reproducción." },
      { status: 500 }
    );
  }
}
