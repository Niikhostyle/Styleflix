import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import {
  listAnimeAv1Embeds,
  resolveAnimeAv1Embed,
} from "@/lib/animeav1";
import { isSourceEnabled } from "@/lib/sources/types";

/**
 * Reproduce un episodio de AnimeAV1 por slug.
 * GET /api/play/animeav1?slug=...&ep=1&server=UPNShare
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
  const embedUrl = picked.url;

  return NextResponse.json({
    source: "animeav1",
    label: "VeoTV",
    embedUrl,
    playKind: "iframe",
    server: picked.server,
    embeds: embeds.map((e) => ({
      server: e.server,
      url: e.url,
    })),
    scrapedFrom: `https://animeav1.com/media/${encodeURIComponent(slug)}/${ep}`,
    maxResolution: maxRes,
    ...(maxRes <= 720
      ? { notice: "Tu plan Estándar reproduce hasta 720p." }
      : {}),
  });
}
