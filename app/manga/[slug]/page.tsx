import { notFound } from "next/navigation";
import { getMangaEsBySlug } from "@/lib/manga-es";
import MangaDetailClient from "@/components/MangaDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const manga = await getMangaEsBySlug(slug).catch(() => null);
  return {
    title: manga?.title ? `${manga.title} | Mangas VeoTV` : "Manga | VeoTV",
    description: manga?.synopsis?.slice(0, 160) || "Manga en español en VeoTV",
  };
}

export default async function MangaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const manga = await getMangaEsBySlug(slug).catch(() => null);
  if (!manga?.slug) notFound();

  return (
    <MangaDetailClient
      manga={{
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        synopsis: manga.synopsis || "",
        poster: manga.poster,
        status: manga.status,
        year: manga.year,
        genres: manga.genres || [],
        chapters: (manga.chapters || []).map((c) => ({
          id: c.id,
          chapter: c.chapter,
          title: c.title,
          pages: c.pages,
        })),
      }}
    />
  );
}
