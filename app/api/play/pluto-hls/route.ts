import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import { isPlutoStreamUrl, rewritePlutoPlaylist } from "@/lib/pluto";
import {
  assertPlaybackLock,
  playbackHeadersFromRequest,
  playbackLockQueryPrefix,
} from "@/lib/playback-lock";
import { getSelectedProfileId } from "@/lib/profiles";

/**
 * Proxy HLS de Pluto (CORS solo permite pluto.tv).
 * GET /api/play/pluto-hls?u=<urlencoded…>&pid=&did=&ltk=
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const live = await requireLiveCatalogAccess(session.user.id);
  if (!live.ok) {
    return NextResponse.json({ error: live.error }, { status: live.status });
  }

  const hdrs = playbackHeadersFromRequest(request);
  const cookieProfile = await getSelectedProfileId();
  const lockCheck = await assertPlaybackLock({
    userId: session.user.id,
    profileId: hdrs.profileId || cookieProfile,
    deviceId: hdrs.deviceId,
    lockToken: hdrs.lockToken,
    bypass: live.user.role === "SUPER_ADMIN" && !hdrs.lockToken,
  });
  if (!lockCheck.ok) {
    return NextResponse.json(
      { error: lockCheck.error, code: "PLAYBACK_LOCK" },
      { status: lockCheck.status }
    );
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
      const lockQ =
        hdrs.deviceId && hdrs.lockToken
          ? playbackLockQueryPrefix({
              profileId: lockCheck.profileId,
              deviceId: hdrs.deviceId,
              lockToken: hdrs.lockToken,
            })
          : "";
      const proxyBase = `${origin}/api/play/pluto-hls?${lockQ}u=`;
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
