import CatalogClient from "@/components/CatalogClient";
import { getAnimeCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Animes | VeoTV",
  description: "Animes en VeoTV",
};

export default async function AnimesPage() {
  const { featured, rows } = await getAnimeCatalog();

  return (
    <CatalogClient
      pageTitle="Animes"
      subtitle="Series y películas de anime listas para ver."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
    />
  );
}
