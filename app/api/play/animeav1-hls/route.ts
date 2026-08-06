import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import {
  fetchZillaUpstream,
  isAnimeAv1ZillaStreamUrl,
  rewriteZillaPlaylist,
} from "@/lib/animeav1";

/**
 * Proxy HLS Zilla (segmentos exigen Referer/Sec-Fetch de su player).
 * GET /api/play/animeav1-hls?u=<urlencoded https://player.zilla-networks.com/...>
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
    return NextResponse.json({ error: "Membresía requerida." }, { status: 403 });
  }

  const src = new URL(request.url).searchParams.get("u");
  if (!src || !isAnimeAv1ZillaStreamUrl(src)) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  try {
    const upstream = await fetchZillaUpstream(src);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await upstream.arrayBuffer());
    const origin = new URL(request.url).origin;
    const proxyBase = `${origin}/api/play/animeav1-hls?u=`;

    const isPlaylist =
      ctype.includes("mpegurl") ||
      ctype.includes("m3u8") ||
      src.includes("/m3u8/") ||
      buf.subarray(0, 7).toString("utf8").startsWith("#EXTM3U");

    if (isPlaylist) {
      const text = buf.toString("utf8");
      const rewritten = rewriteZillaPlaylist(text, src, proxyBase);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": origin,
        },
      });
    }

    // Segmentos fMP4 disfrazados de .html
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": origin,
      },
    });
  } catch (err) {
    console.error("[animeav1-hls]", err);
    return NextResponse.json({ error: "Proxy falló." }, { status: 500 });
  }
}
