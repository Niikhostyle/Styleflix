import CatalogClient from "@/components/CatalogClient";
import { getMoviesCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Películas | VeoTV",
  description: "Películas en VeoTV",
};

export default async function PeliculasPage() {
  const { featured, rows } = await getMoviesCatalog();

  return (
    <CatalogClient
      pageTitle="Películas"
      subtitle="Todo el catálogo de películas de VeoTV."
      featured={featured}
      defaultMediaType="movie"
      rows={rows}
    />
  );
}
