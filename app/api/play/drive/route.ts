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
    const { response: upstream, contentType } = await openGoogleDriveStream({
      fileId,
      range,
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error("[drive] upstream", upstream.status, fileId);
      return NextResponse.json(
        { error: `Drive respondió ${upstream.status}` },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=0, no-store");
    headers.set("Accept-Ranges", "bytes");

    const pass = [
      "content-length",
      "content-range",
      "accept-ranges",
    ] as const;
    for (const name of pass) {
      const v = upstream.headers.get(name);
      if (v) headers.set(name, v);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Proxy Drive falló";
    console.error("[drive]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
