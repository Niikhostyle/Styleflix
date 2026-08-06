import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import { extractGoogleDriveFileId } from "@/lib/embed-url";
import { openGoogleDriveStream } from "@/lib/drive-stream";
import {
  assertPlaybackLock,
  playbackHeadersFromRequest,
} from "@/lib/playback-lock";
import { getSelectedProfileId } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de video desde Google Drive (archivo público con enlace).
 * GET /api/play/drive?id=FILE_ID&pid=&did=&ltk=
 * Soporta Range para seeking en <video>.
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

  const { searchParams } = new URL(request.url);
  const idParam = (searchParams.get("id") || "").trim();
  const urlParam = (searchParams.get("u") || "").trim();
  const fileId =
    (idParam && /^[\w-]+$/.test(idParam) ? idParam : null) ||
    (urlParam ? extractGoogleDriveFileId(urlParam) : null);

  if (!fileId) {
    return NextResponse.json({ error: "Falta id de Drive." }, { status: 400 });
  }

  const range = request.headers.get("range");

  try {
    const upstream = await openGoogleDriveStream({ fileId, range });

    const headers = new Headers();
    headers.set("Content-Type", upstream.contentType);
    headers.set("Cache-Control", "private, max-age=0, no-store");
    headers.set("Accept-Ranges", upstream.acceptRanges || "bytes");
    if (upstream.contentLength) {
      headers.set("Content-Length", upstream.contentLength);
    }
    if (upstream.contentRange) {
      headers.set("Content-Range", upstream.contentRange);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Proxy Drive falló";
    console.error("[drive]", fileId, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
