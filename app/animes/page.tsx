import CatalogClient from "@/components/CatalogClient";
import { getAnimeCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Animes | VeoTV",
  description: "Catálogo de animes de AnimeAV1 en VeoTV",
};

export default async function AnimesPage() {
  const { featured, rows } = await getAnimeCatalog();

  return (
    <CatalogClient
      pageTitle="Animes"
      subtitle="Catálogo scrapado de AnimeAV1 — reproducción con créditos a animeav1.com."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
    />
  );
}
