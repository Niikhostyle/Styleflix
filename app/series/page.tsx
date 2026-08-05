import CatalogClient from "@/components/CatalogClient";
import { getSeriesCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series | VeoTV",
  description: "Series en VeoTV",
};

export default async function SeriesPage() {
  const { featured, rows } = await getSeriesCatalog();

  return (
    <CatalogClient
      pageTitle="Series"
      subtitle="Todo el catálogo de series de VeoTV."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
    />
  );
}
