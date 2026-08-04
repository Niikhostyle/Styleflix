import { NextResponse } from "next/server";
import {
  getVimeusEmbedUrl,
  vimeusEmbedHasSources,
  vimeusHasTmdbId,
} from "@/lib/vimeus";
import { findPlutoMatch } from "@/lib/pluto";
import type { MediaType } from "@/lib/tmdb";

/**
 * Resuelve fuente de reproducción: Vimeus primero, PlutoTV de respaldo.
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

  const season = se != null ? Number(se) : type === "tv" ? 1 : undefined;
  const episode = ep != null ? Number(ep) : type === "tv" ? 1 : undefined;
  const vimeusOpts = {
    season: type === "tv" ? season : undefined,
    episode: type === "tv" ? episode : undefined,
    anime: type === "tv" ? anime : undefined,
  };

  try {
    let vimeusOk = await vimeusHasTmdbId(type, tmdb, { anime });
    if (!vimeusOk) {
      vimeusOk = await vimeusEmbedHasSources(type, tmdb, vimeusOpts);
    }

    if (vimeusOk && process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY) {
      const embedUrl = getVimeusEmbedUrl(type, tmdb, vimeusOpts);
      return NextResponse.json({
        source: "vimeus",
        label: "Vimeus",
        embedUrl,
      });
    }

    if (title) {
      const pluto = await findPlutoMatch({
        title,
        mediaType: type,
        year: Number.isFinite(year as number) ? year : null,
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

    return NextResponse.json(
      {
        error: "No disponible en Vimeus ni Pluto TV",
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
