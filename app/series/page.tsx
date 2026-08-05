import CatalogClient from "@/components/CatalogClient";
import { getSeriesCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series | VeoTV",
  description: "Series de Vimeus, Pluto TV y TMDB en VeoTV",
};

export default async function SeriesPage() {
  const { featured, rows, activeSources } = await getSeriesCatalog();

  return (
    <CatalogClient
      pageTitle="Series"
      subtitle="Catálogo reunido desde Vimeus, Pluto TV y TMDB."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
      activeSources={activeSources}
    />
  );
}
