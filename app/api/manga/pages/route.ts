import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import {
  getMangaChapterPages,
  isMangaDexChapterId,
  mangaChapterImageUrls,
} from "@/lib/manga-es";
import { fetchYupChapterPageUrls } from "@/lib/yupmanga";

export const dynamic = "force-dynamic";

/** Páginas de un capítulo (YupManga o MangaDex at-home). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const live = await requireLiveCatalogAccess(session.user.id);
  if (!live.ok) {
    return NextResponse.json({ error: live.error }, { status: live.status });
  }

  const sp = new URL(request.url).searchParams;
  const chapterId = sp.get("chapterId") || "";
  const seriesId = sp.get("seriesId") || "";
  if (!chapterId || chapterId.length < 1) {
    return NextResponse.json({ error: "Capítulo inválido." }, { status: 400 });
  }

  const useYup = !isMangaDexChapterId(chapterId);
  if (useYup) {
    if (!seriesId) {
      return NextResponse.json(
        { error: "Falta seriesId para YupManga." },
        { status: 400 }
      );
    }
    const yup = await fetchYupChapterPageUrls(seriesId, chapterId);
    if (!yup?.urls?.length) {
      return NextResponse.json(
        { error: "No se pudieron cargar las páginas." },
        { status: 502 }
      );
    }
    const proxied = yup.urls.map(
      (u) => `/api/manga/image?u=${encodeURIComponent(u)}`
    );
    return NextResponse.json({
      images: proxied,
      count: proxied.length,
      source: "yupmanga",
    });
  }

  const pages = await getMangaChapterPages(chapterId);
  if (!pages) {
    return NextResponse.json(
      { error: "No se pudieron cargar las páginas." },
      { status: 502 }
    );
  }

  const saver = sp.get("hq") !== "1";
  const urls = mangaChapterImageUrls(pages, saver);
  const proxied = urls.map(
    (u) => `/api/manga/image?u=${encodeURIComponent(u)}`
  );
  return NextResponse.json({
    images: proxied,
    count: proxied.length,
    source: "mangadex",
  });
}
