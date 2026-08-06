import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { resolveAnimeAv1Embed } from "@/lib/animeav1";
import { isSourceEnabled } from "@/lib/sources/types";

/**
 * Reproduce un episodio de AnimeAV1 por slug.
 * GET /api/play/animeav1?slug=...&ep=1
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

  if (!slug) {
    return NextResponse.json({ error: "Falta slug." }, { status: 400 });
  }

  const embed = await resolveAnimeAv1Embed({
    slug,
    episode: ep,
    preferDub,
  }).catch(() => null);

  if (!embed?.url) {
    return NextResponse.json(
      { error: "Episodio no disponible." },
      { status: 404 }
    );
  }

  const maxRes = session.user.planMaxResolution || 1080;

  return NextResponse.json({
    source: "animeav1",
    label: "VeoTV",
    embedUrl: embed.url,
    playKind: "iframe",
    server: embed.server,
    lang: embed.lang,
    maxResolution: maxRes,
    ...(maxRes <= 720
      ? { notice: "Tu plan Estándar reproduce hasta 720p." }
      : {}),
  });
}
