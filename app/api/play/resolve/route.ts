import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import {
  getVimeusEmbedUrl,
  vimeusEmbedHasSources,
  vimeusHasTmdbId,
} from "@/lib/vimeus";
import { findPlutoMatch } from "@/lib/pluto";
import { findArchiveMatch } from "@/lib/sources/archive";
import { findCustomStream } from "@/lib/sources/custom";
import { isSourceEnabled } from "@/lib/sources/types";
import {
  getBestTrailerKey,
  getMediaDetails,
  getTrailerPlayerUrl,
  type MediaType,
} from "@/lib/tmdb";

/**
 * Resuelve la fuente de reproducción en cascada.
 * Requiere membresía activa. Avisa resolución máxima del plan.
 * Orden: links propios → Vimeus → Pluto → Archive → tráiler.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (
    !hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json(
      { error: "Necesitas una membresía activa para reproducir." },
      { status: 403 }
    );
  }

  const maxRes = session.user.planMaxResolution || 1080;
  const resNotice =
    maxRes <= 720 ? "Tu plan Estándar reproduce hasta 720p." : undefined;

  const { searchParams } = new URL(request.url);
  const tmdb = Number(searchParams.get("tmdb"));
  const type = (searchParams.get("type") || "movie") as MediaType;
  const title = (searchParams.get("title") || "").trim();
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  const se = searchParams.get("se");
  const ep = searchParams.get("ep");
  const anime = searchParams.get("anime") === "1";

  if (
    !Number.isFinite(tmdb) ||
    tmdb <= 0 ||
    (type !== "movie" && type !== "tv")
  ) {
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

  function withPlanMeta(payload: Record<string, unknown>) {
    const notice =
      typeof payload.notice === "string" && payload.notice
        ? resNotice
          ? `${payload.notice} · ${resNotice}`
          : payload.notice
        : resNotice;
    return {
      ...payload,
      maxResolution: maxRes,
      ...(notice ? { notice } : {}),
    };
  }

  try {
    const custom = await findCustomStream({
      mediaType: type,
      tmdbId: tmdb,
      season: type === "tv" ? season : undefined,
      episode: type === "tv" ? episode : undefined,
    });
    if (custom?.embedUrl) {
      return NextResponse.json(
        withPlanMeta({
          source: "custom",
          label: custom.label || "VeoTV",
          embedUrl: custom.embedUrl,
        })
      );
    }

    if (isSourceEnabled("vimeus")) {
      let vimeusOk = await vimeusHasTmdbId(type, tmdb, { anime });
      if (!vimeusOk) {
        vimeusOk = await vimeusEmbedHasSources(type, tmdb, vimeusOpts);
      }

      if (vimeusOk && process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY) {
        return NextResponse.json(
          withPlanMeta({
            source: "vimeus",
            label: "Vimeus",
            embedUrl: getVimeusEmbedUrl(type, tmdb, vimeusOpts),
          })
        );
      }
    }

    if (title && isSourceEnabled("pluto")) {
      const pluto = await findPlutoMatch({
        title,
        mediaType: type,
        year: safeYear,
      });
      if (pluto) {
        return NextResponse.json(
          withPlanMeta({
            source: "pluto",
            label: "Pluto TV",
            embedUrl: pluto.watchUrl,
            pluto: {
              id: pluto.id,
              slug: pluto.slug,
              name: pluto.name,
              type: pluto.type,
            },
          })
        );
      }
    }

    if (title && type === "movie" && isSourceEnabled("archive")) {
      const archive = await findArchiveMatch({ title, year: safeYear });
      if (archive) {
        return NextResponse.json(
          withPlanMeta({
            source: "archive",
            label: "Archive.org",
            embedUrl: archive.embedUrl,
            archive: { identifier: archive.identifier },
          })
        );
      }
    }

    const trailerKey = await getMediaDetails(type, tmdb)
      .then(getBestTrailerKey)
      .catch(() => null);

    if (trailerKey) {
      return NextResponse.json(
        withPlanMeta({
          source: "trailer",
          label: "Tráiler",
          embedUrl: getTrailerPlayerUrl(trailerKey),
          fallback: true,
          notice: "Aún no hay stream de este título. Te mostramos el tráiler.",
        })
      );
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
