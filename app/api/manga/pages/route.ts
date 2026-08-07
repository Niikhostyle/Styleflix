import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import {
  getMangaChapterPages,
  mangaChapterImageUrls,
} from "@/lib/manga-es";

export const dynamic = "force-dynamic";

/** Páginas de un capítulo (MangaDex at-home). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const live = await requireLiveCatalogAccess(session.user.id);
  if (!live.ok) {
    return NextResponse.json({ error: live.error }, { status: live.status });
  }

  const chapterId = new URL(request.url).searchParams.get("chapterId") || "";
  if (!chapterId || chapterId.length < 8) {
    return NextResponse.json({ error: "Capítulo inválido." }, { status: 400 });
  }

  const pages = await getMangaChapterPages(chapterId);
  if (!pages) {
    return NextResponse.json(
      { error: "No se pudieron cargar las páginas." },
      { status: 502 }
    );
  }

  const saver = new URL(request.url).searchParams.get("hq") !== "1";
  const urls = mangaChapterImageUrls(pages, saver);
  // Relative: evita origin interno del contenedor detrás de Coolify/CF
  const proxied = urls.map(
    (u) => `/api/manga/image?u=${encodeURIComponent(u)}`
  );
  return NextResponse.json({
    images: proxied,
    count: proxied.length,
  });
}
