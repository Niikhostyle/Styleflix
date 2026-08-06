import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasCatalogAccess } from "@/lib/access";
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
  if (
    session.user.role !== "SUPER_ADMIN" &&
    !hasCatalogAccess({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
      demoExpiresAt: session.user.demoExpiresAt,
    })
  ) {
    return NextResponse.json(
      { error: "Necesitas membresía o demo para leer." },
      { status: 403 }
    );
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
  return NextResponse.json({
    images: mangaChapterImageUrls(pages, saver),
    count: mangaChapterImageUrls(pages, saver).length,
  });
}
