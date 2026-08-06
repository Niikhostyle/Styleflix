import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import {
  animeAv1M3u8Url,
  animeAv1ZillaHash,
  isAnimeAv1HlsUrl,
  listAnimeAv1Embeds,
  resolveAnimeAv1Embed,
} from "@/lib/animeav1";
import { signAnimeAv1StreamToken } from "@/lib/animeav1-token";
import { isSourceEnabled } from "@/lib/sources/types";

/**
 * Scrapea embeds de AnimeAV1.
 * HLS → proxy Zilla + player nativo (hls.js); mirrors → iframe.
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

  function mapEmbed(e: { server: string; url: string }) {
    const hls = isAnimeAv1HlsUrl(e.url);
    if (!hls) {
      return {
        server: e.server,
        url: e.url,
        playKind: "iframe" as const,
      };
    }
    const hash = animeAv1ZillaHash(e.url);
    const m3u8 = animeAv1M3u8Url(e.url);
    const t = hash
      ? signAnimeAv1StreamToken({ hash, userId: session!.user!.id })
      : "";
    // Relativas: mismo host que ve el usuario (evita localhost del contenedor Coolify).
    const streamUrl = `/api/play/animeav1-hls?t=${encodeURIComponent(t)}&u=${encodeURIComponent(m3u8)}`;
    const embedUrl = hash
      ? `/api/play/animeav1-embed?hash=${hash}&t=${encodeURIComponent(t)}`
      : streamUrl;
    return {
      server: e.server,
      url: streamUrl,
      streamUrl,
      embedUrl,
      playKind: "hls" as const,
      hls: true,
    };
  }

  const mapped = embeds.map(mapEmbed);
  const pickedMapped =
    mapped.find((e) => e.server.toLowerCase() === picked.server.toLowerCase()) ||
    mapped[0];

  return NextResponse.json({
    source: "animeav1",
    label: "VeoTV",
    embedUrl:
      ("embedUrl" in pickedMapped && pickedMapped.embedUrl) ||
      pickedMapped.url,
    streamUrl:
      ("streamUrl" in pickedMapped && pickedMapped.streamUrl) ||
      (pickedMapped.playKind === "hls" ? pickedMapped.url : undefined),
    playKind: pickedMapped.playKind || "iframe",
    server: pickedMapped.server,
    embeds: mapped,
    maxResolution: maxRes,
    ...(maxRes <= 720
      ? { notice: "Tu plan Estándar reproduce hasta 720p." }
      : {}),
  });
}
