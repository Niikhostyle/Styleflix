import CatalogClient from "@/components/CatalogClient";
import { getAnimeCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Animes | VeoTV",
  description: "Anime de Vimeus, MyAnimeList y TMDB en VeoTV",
};

export default async function AnimesPage() {
  const { featured, rows, activeSources } = await getAnimeCatalog();

  return (
    <CatalogClient
      pageTitle="Animes"
      subtitle="Catálogo reunido desde Vimeus, MyAnimeList y TMDB."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
      activeSources={activeSources}
    />
  );
}
