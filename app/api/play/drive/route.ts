import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasCatalogAccess } from "@/lib/access";
import { extractGoogleDriveFileId } from "@/lib/embed-url";
import { openGoogleDriveStream } from "@/lib/drive-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de video desde Google Drive (archivo público con enlace).
 * GET /api/play/drive?id=FILE_ID
 * Soporta Range para seeking en <video>.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (
    !hasCatalogAccess({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
      demoExpiresAt: session.user.demoExpiresAt,
    })
  ) {
    return NextResponse.json(
      { error: "Necesitas membresía o demo activa." },
      { status: 403 }
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
