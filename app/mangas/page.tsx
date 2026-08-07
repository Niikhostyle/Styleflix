import MangaCatalogClient from "@/components/MangaCatalogClient";
import { getMangaCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mangas | VeoTV",
  description: "Mangas populares en español — lectura en VeoTV",
};

export default async function MangasPage() {
  const empty = { featured: [], rows: [] };
  const { featured, rows } = await getMangaCatalog().catch(() => empty);

  return <MangaCatalogClient featured={featured} rows={rows} />;
}
