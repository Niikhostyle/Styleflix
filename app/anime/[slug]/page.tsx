import { notFound } from "next/navigation";
import { getAnime } from "animeav1-api";
import AnimeAv1DetailClient from "@/components/AnimeAv1DetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anime = await getAnime(slug).catch(() => null);
  return {
    title: anime?.title
      ? `${anime.title} | Animes VeoTV`
      : "Anime | VeoTV",
    description: anime?.synopsis?.slice(0, 160) || "Anime en VeoTV",
  };
}

export default async function AnimeAv1Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anime = await getAnime(slug).catch(() => null);
  if (!anime?.slug) notFound();

  return (
    <AnimeAv1DetailClient
      anime={{
        id: anime.id,
        title: anime.title,
        slug: anime.slug,
        synopsis: anime.synopsis || "",
        poster: anime.poster,
        backdrop: anime.backdrop,
        statusText: anime.statusText,
        startDate: anime.startDate,
        episodesCount: anime.episodesCount || anime.episodes?.length || 0,
        score: anime.score,
        genres: (anime.genres || []).map((g) => ({ name: g.name })),
        episodes: (anime.episodes || []).map((e) => ({
          id: e.id,
          number: e.number,
        })),
      }}
    />
  );
}
