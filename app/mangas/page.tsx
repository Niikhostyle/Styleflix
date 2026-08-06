import CatalogClient from "@/components/CatalogClient";
import { getMangaCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mangas | VeoTV",
  description: "Mangas populares en español en VeoTV",
};

export default async function MangasPage() {
  const { featured, rows } = await getMangaCatalog();

  return (
    <CatalogClient
      pageTitle="Mangas"
      subtitle="Mangas populares con capítulos en español. Al lado de Animes."
      featured={featured}
      defaultMediaType="tv"
      rows={rows}
    />
  );
}
