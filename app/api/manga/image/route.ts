import { NextResponse } from "next/server";
import { isAllowedMangaImageHost } from "@/lib/manga-es";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Proxy de páginas MangaDex (evita bloqueos hotlink / referrer en VPS).
 * GET /api/manga/image?u=<urlencoded>
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "Solo HTTPS." }, { status: 400 });
  }
  if (!isAllowedMangaImageHost(target.hostname)) {
    return NextResponse.json({ error: "Host no permitido." }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: "image/*,*/*",
        Referer: "https://mangadex.org/",
        "User-Agent": "VeoTV/1.0 (manga-reader)",
      },
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "No se pudo obtener la imagen." },
        { status: 502 }
      );
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Error de red." }, { status: 502 });
  }
}
