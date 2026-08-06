import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import {
  animeAv1ZillaHash,
  fetchZillaUpstream,
  isAnimeAv1ZillaStreamUrl,
  rewriteZillaPlaylist,
} from "@/lib/animeav1";
import { verifyAnimeAv1StreamToken } from "@/lib/animeav1-token";
import {
  assertPlaybackLock,
  playbackHeadersFromRequest,
  playbackLockQueryPrefix,
} from "@/lib/playback-lock";
import { getSelectedProfileId } from "@/lib/profiles";
import { requestPublicOrigin } from "@/lib/public-url";

/**
 * Proxy HLS Zilla (igual que el stream de animeav1.com / JWPlayer+hlsjs).
 * Auth: token firmado `t` (fragmentos HLS) + lock pid/did/ltk.
 * GET /api/play/animeav1-hls?u=...&t=...&pid=&did=&ltk=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("u");
  const token = searchParams.get("t");

  if (!src || !isAnimeAv1ZillaStreamUrl(src)) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  const hash = animeAv1ZillaHash(src);
  const tokenOk = verifyAnimeAv1StreamToken(token, hash || undefined);

  let userId: string | null = null;
  let isAdmin = false;

  if (tokenOk.ok) {
    userId = tokenOk.userId;
    const live = await requireLiveCatalogAccess(userId);
    if (!live.ok) {
      return NextResponse.json({ error: live.error }, { status: live.status });
    }
    isAdmin = live.user.role === "SUPER_ADMIN";
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    const live = await requireLiveCatalogAccess(session.user.id);
    if (!live.ok) {
      return NextResponse.json({ error: live.error }, { status: live.status });
    }
    userId = session.user.id;
    isAdmin = live.user.role === "SUPER_ADMIN";
  }

  const hdrs = playbackHeadersFromRequest(request);
  const cookieProfile = await getSelectedProfileId().catch(() => null);
  const lockCheck = await assertPlaybackLock({
    userId: userId!,
    profileId: hdrs.profileId || cookieProfile,
    deviceId: hdrs.deviceId,
    lockToken: hdrs.lockToken,
    bypass: isAdmin && !hdrs.lockToken,
  });
  if (!lockCheck.ok) {
    return NextResponse.json(
      { error: lockCheck.error, code: "PLAYBACK_LOCK" },
      { status: lockCheck.status }
    );
  }

  try {
    const upstream = await fetchZillaUpstream(src);
    if (!upstream.ok) {
      console.error("[animeav1-hls] upstream", upstream.status, src.slice(0, 80));
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await upstream.arrayBuffer());
    const origin = requestPublicOrigin(request);

    const tokenQ = tokenOk.ok
      ? `t=${encodeURIComponent(token!)}&`
      : token
        ? `t=${encodeURIComponent(token)}&`
        : "";
    const lockQ =
      hdrs.deviceId && hdrs.lockToken
        ? playbackLockQueryPrefix({
            profileId: lockCheck.profileId,
            deviceId: hdrs.deviceId,
            lockToken: hdrs.lockToken,
          })
        : "";
    const proxyBase = `/api/play/animeav1-hls?${tokenQ}${lockQ}u=`;

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

    const looksFmp4 =
      buf.length > 8 &&
      (buf.slice(4, 8).toString("utf8") === "ftyp" ||
        buf.slice(4, 8).toString("utf8") === "styp" ||
        buf.slice(4, 8).toString("utf8") === "moof");

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": looksFmp4
          ? "video/mp4"
          : ctype.includes("html")
            ? "application/octet-stream"
            : ctype || "application/octet-stream",
        "Cache-Control": "public, max-age=120",
        "Access-Control-Allow-Origin": origin,
      },
    });
  } catch (err) {
    console.error("[animeav1-hls]", err);
    return NextResponse.json({ error: "Proxy falló." }, { status: 500 });
  }
}
