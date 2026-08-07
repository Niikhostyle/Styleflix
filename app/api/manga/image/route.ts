import { unlink, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAllowedMangaImageHost } from "@/lib/manga-es";
import { yupRequest } from "@/lib/yupmanga";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isYupMangaHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "www.yupmanga.com" || h === "yupmanga.com";
}

/**
 * Proxy de páginas manga (MangaDex / YupManga).
 * YupManga bloquea Node fetch (CF) → curl vía yupRequest.
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

  if (isYupMangaHost(target.hostname)) {
    const tempFile = path.join(
      os.tmpdir(),
      `veotv-yup-img-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`
    );
    try {
      const res = yupRequest({ url: target.toString(), binaryOut: tempFile });
      if (!res.ok) {
        return NextResponse.json(
          { error: "No se pudo obtener la imagen." },
          { status: 502 }
        );
      }
      const buf = await readFile(tempFile);
      const ext = target.pathname.toLowerCase();
      const ct =
        ext.includes(".png")
          ? "image/png"
          : ext.includes(".webp")
            ? "image/webp"
            : ext.includes(".gif")
              ? "image/gif"
              : "image/jpeg";
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Cache-Control":
            "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      return NextResponse.json({ error: "Error de red." }, { status: 502 });
    } finally {
      await unlink(tempFile).catch(() => undefined);
    }
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
