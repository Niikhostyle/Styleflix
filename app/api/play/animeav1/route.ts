import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import {
  animeAv1M3u8Url,
  isAnimeAv1HlsUrl,
  listAnimeAv1Embeds,
  resolveAnimeAv1Embed,
} from "@/lib/animeav1";
import { isSourceEnabled } from "@/lib/sources/types";

/**
 * Reproduce un episodio scrapado de AnimeAV1.
 * HLS → proxy nativo; otros → iframe.
 * GET /api/play/animeav1?slug=...&ep=1&server=HLS
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

  if (!isSourceEnabled("animeav1")) {
    return NextResponse.json(
      { error: "Fuente de anime no disponible." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") || "").trim();
  const ep = Math.max(1, Number(searchParams.get("ep") || "1") || 1);
  const preferDub = searchParams.get("dub") === "1";
  const wantServer = (searchParams.get("server") || "").trim().toLowerCase();

  if (!slug) {
    return NextResponse.json({ error: "Falta slug." }, { status: 400 });
  }

  const embeds = await listAnimeAv1Embeds({
    slug,
    episode: ep,
    preferDub,
  }).catch(() => []);

  if (!embeds.length) {
    return NextResponse.json(
      { error: "Episodio no disponible." },
      { status: 404 }
    );
  }

  const picked =
    (wantServer
      ? embeds.find((e) => e.server.toLowerCase() === wantServer)
      : null) ||
    (await resolveAnimeAv1Embed({ slug, episode: ep, preferDub }).catch(
      () => null
    )) ||
    embeds[0];

  if (!picked?.url) {
    return NextResponse.json(
      { error: "Episodio no disponible." },
      { status: 404 }
    );
  }

  const maxRes = session.user.planMaxResolution || 1080;
  const origin = new URL(request.url).origin;
  const hls = isAnimeAv1HlsUrl(picked.url);
  const m3u8 = hls ? animeAv1M3u8Url(picked.url) : null;
  const streamUrl = m3u8
    ? `${origin}/api/play/animeav1-hls?u=${encodeURIComponent(m3u8)}`
    : undefined;

  return NextResponse.json({
    source: "animeav1",
    label: "VeoTV",
    embedUrl: picked.url,
    streamUrl,
    playKind: hls ? "hls" : "iframe",
    server: picked.server,
    embeds: embeds.map((e) => {
      const eHls = isAnimeAv1HlsUrl(e.url);
      const eM3u8 = eHls ? animeAv1M3u8Url(e.url) : null;
      return {
        server: e.server,
        url: e.url,
        playKind: eHls ? "hls" : "iframe",
        streamUrl: eM3u8
          ? `${origin}/api/play/animeav1-hls?u=${encodeURIComponent(eM3u8)}`
          : undefined,
      };
    }),
    maxResolution: maxRes,
    ...(maxRes <= 720
      ? { notice: "Tu plan Estándar reproduce hasta 720p." }
      : {}),
  });
}
