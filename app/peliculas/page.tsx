import CatalogClient from "@/components/CatalogClient";
import { getMoviesCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Películas | VeoTV",
  description: "Películas de Vimeus, Pluto TV, Archive.org y TMDB en VeoTV",
};

export default async function PeliculasPage() {
  const { featured, rows, activeSources } = await getMoviesCatalog();

  return (
    <CatalogClient
      pageTitle="Películas"
      subtitle="Catálogo reunido desde Vimeus, Pluto TV, Archive.org y TMDB."
      featured={featured}
      defaultMediaType="movie"
      rows={rows}
      activeSources={activeSources}
    />
  );
}
