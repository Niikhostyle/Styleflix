import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { isPlutoStreamUrl, rewritePlutoPlaylist } from "@/lib/pluto";

/**
 * Proxy HLS de Pluto (CORS solo permite pluto.tv).
 * GET /api/play/pluto-hls?u=<urlencoded https://…pluto…/master.m3u8>
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
  if (!src || !isPlutoStreamUrl(src)) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  try {
    const upstream = await fetch(src, {
      headers: {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        Referer: "https://pluto.tv/",
        Origin: "https://pluto.tv",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await upstream.arrayBuffer());

    const isPlaylist =
      ctype.includes("mpegurl") ||
      ctype.includes("m3u8") ||
      src.includes(".m3u8") ||
      buf.subarray(0, 7).toString("utf8").startsWith("#EXTM3U");

    if (isPlaylist) {
      const text = buf.toString("utf8");
      const origin = new URL(request.url).origin;
      const proxyBase = `${origin}/api/play/pluto-hls?u=`;
      const rewritten = rewritePlutoPlaylist(text, src, proxyBase);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": origin,
        },
      });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ctype || "application/octet-stream",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (err) {
    console.error("[pluto-hls]", err);
    return NextResponse.json({ error: "Proxy falló." }, { status: 500 });
  }
}
